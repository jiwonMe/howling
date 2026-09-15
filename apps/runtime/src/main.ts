/**
 * Runtime 진입점.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { HaStatus } from "@howling/contracts";
import { createRuntimeApp } from "./app.js";
import { loadRuntimeConfig } from "./config.js";
import { createRuntimeHost } from "./coordinator/host.js";
import { openSqlite } from "./db/client.js";
import { getIdentity, upsertIdentity } from "./db/identity.js";
import { migrateSqlite } from "./db/migrate.js";
import { createFakeAdapter } from "./effects/fake-adapter.js";
import { handleCloudControl } from "./gateway/control.js";
import { startRuntimeGateway } from "./gateway/client.js";
import { flushUnackedSummaries, publishRunSummary } from "./gateway/summary.js";
import { applyCaptureGate, flushUnackedRaw, publishRunRaw } from "./data/publish-raw.js";
import { retainLocal } from "./data/retain.js";
import { flushUnackedObserve, tickObserver } from "./observe/tick.js";
import { resolveHaEndpoint } from "./ha/supervisor.js";
import { createDeviceAwareAdapter } from "./devices/adapter.js";
import { handleDevicesAction } from "./devices/act.js";
import { handleDevicesCreate } from "./devices/create.js";
import { handleDevicesIntegrate } from "./devices/integrate.js";
import { reportDevices } from "./devices/report.js";
import { syncDeviceCatalog, upsertDevices } from "./devices/store.js";
import { dispatchDeviceTriggers } from "./devices/triggers.js";
import { createHaAwareAdapter } from "./ha/adapter.js";
import { startHaConnector, type HaHandle } from "./ha/client.js";
import { createHaCallLog } from "./ha/hooks.js";
import { dispatchHaTriggers } from "./ha/triggers.js";
import { createMcpAwareAdapter } from "./mcp/adapter.js";
import { finishMcpOauth, pendingOauthByState } from "./mcp/oauth.js";
import { createMcpRegistry } from "./mcp/registry.js";
import { reportConnections } from "./mcp/report.js";
import { listConnections } from "./mcp/store.js";
import { readSecret } from "./secrets/store.js";
import { createPairingState } from "./setup/pairing.js";
import { readRuntimeToken } from "./token.js";

const config = loadRuntimeConfig();
const db = openSqlite(config.sqlitePath);
const migrations = join(dirname(fileURLToPath(import.meta.url)), "../migrations");
migrateSqlite(db, migrations);

const stored = getIdentity(db);
const session = {
  runtimeId: stored?.runtimeId ?? config.runtimeId,
  siteId: stored?.siteId ?? config.siteId,
  token: readSecret(config.secretRoot, "runtime-token") ?? readRuntimeToken(config),
};
upsertIdentity(db, { ...config, runtimeId: session.runtimeId, siteId: session.siteId });

const haLog = createHaCallLog();
let ha: HaHandle | undefined;
const mcpRegistry = createMcpRegistry(db, config.secretRoot);
let host: ReturnType<typeof createRuntimeHost>;
const adapter = createMcpAwareAdapter({
  next: createDeviceAwareAdapter({
    next: createHaAwareAdapter({
      fake: createFakeAdapter(),
      ha: () => ha,
      testHooks: config.testHooks,
    }),
    db,
    onVirtualEvent: (event) => {
      dispatchDeviceTriggers(host, event, false);
      reportDevices(gateway, db);
    },
  }),
  registry: () => mcpRegistry,
});
host = createRuntimeHost({ db, adapter });

let gateway: ReturnType<typeof startRuntimeGateway>;
gateway = startRuntimeGateway(
  { ...config, runtimeId: session.runtimeId, siteId: session.siteId },
  session.token,
  undefined,
  (envelope) => {
    handleCloudControl(host, gateway, envelope, {
      onOauthCode: (state, code) => {
        void acceptOauthCode(state, code);
      },
      onDevicesAction: async (payload) => {
        const result = await handleDevicesAction(
          {
            db,
            onEvent: (event) => {
              dispatchDeviceTriggers(host, event, false);
            },
            ...(ha ? { ha } : {}),
          },
          payload,
        );
        if (result.device) {
          reportDevices(gateway, db);
        }
        return result;
      },
      onDevicesCreate: async (payload) => {
        const result = await handleDevicesCreate(
          { db, runtimeId: session.runtimeId, ...(ha ? { ha } : {}) },
          payload,
        );
        if (result.device || (result.devices && result.devices.length > 0)) {
          reportDevices(gateway, db);
        }
        return result;
      },
      onDevicesIntegrate: async (payload) => {
        const result = await handleDevicesIntegrate(
          { db, runtimeId: session.runtimeId, ...(ha ? { ha } : {}) },
          payload,
        );
        if (result.status === "done") {
          reportDevices(gateway, db);
        }
        return result;
      },
    });
  },
  () => {
    applyCaptureGate(host.db);
    flushUnackedSummaries(host, gateway);
    flushUnackedRaw(host.db, gateway);
    flushUnackedObserve(host.db, gateway);
  },
);

const reportAll = (status?: HaStatus) => {
  reportConnections(
    gateway,
    { status: status ?? ha?.status() ?? "not_configured", lastSyncAt: ha?.lastSyncAt() ?? null },
    mcpRegistry.snapshot(),
  );
  reportDevices(gateway, db);
};

const startHa = () => {
  ha?.stop();
  const endpoint = resolveHaEndpoint({
    ...(process.env.SUPERVISOR_TOKEN ? { supervisorToken: process.env.SUPERVISOR_TOKEN } : {}),
    url: readSecret(config.secretRoot, "ha-url"),
    token: readSecret(config.secretRoot, "ha-token"),
  });
  if (!endpoint) {
    return;
  }
  ha = startHaConnector({
    url: endpoint.url,
    token: endpoint.token,
    ...(endpoint.websocketPath ? { websocketPath: endpoint.websocketPath } : {}),
    onStatus: reportAll,
    onEntities: (items) => {
      try {
        syncDeviceCatalog(db, session.runtimeId, items);
        reportDevices(gateway, db);
      } catch {
        // 카탈로그 실패는 HA 구독을 끊지 않는다.
      }
    },
    onEvent: (event) => {
      dispatchHaTriggers(host, event, false);
      dispatchDeviceTriggers(host, event, false);
      try {
        upsertDevices(db, session.runtimeId, [event]);
        reportDevices(gateway, db);
      } catch {
        // 카탈로그 실패는 실행을 멈추지 않는다.
      }
    },
    onCall: haLog.record,
  });
};

const acceptOauthCode = async (state: string, code: string): Promise<void> => {
  const ids = listConnections(db, "mcp").map((row) => row.id);
  const pending = pendingOauthByState(config.secretRoot, ids, state);
  if (!pending) {
    return;
  }
  const ok = await finishMcpOauth(config.secretRoot, pending.connectionId, state, code);
  if (!ok) {
    return;
  }
  await mcpRegistry.reload();
  reportAll();
};

host.afterCommit = (hint) => {
  try {
    publishRunSummary(host, gateway, hint.runId);
  } catch {
    // 요약 전송 실패는 실행을 멈추지 않는다.
  }
  try {
    publishRunRaw(host.db, gateway, hint.runId);
  } catch {
    // raw 실패는 summary를 막지 않는다.
  }
  tickObserver(host.db, gateway);
  return "continue";
};

const pairing = createPairingState();
const pairingDeps = {
  apiHttpUrl: config.apiHttpUrl,
  secretRoot: config.secretRoot,
  onCredential: (next: { token: string; runtimeId: string; siteId: string }) => {
    session.runtimeId = next.runtimeId;
    session.siteId = next.siteId;
    session.token = next.token;
    upsertIdentity(db, { ...config, runtimeId: next.runtimeId, siteId: next.siteId });
    gateway.setIdentity(next);
  },
};

host.recover();
await host.waitIdle();
await mcpRegistry.reload();
startHa();
reportAll();
retainLocal(host.db);
const reportTimer = setInterval(() => reportAll(), 5000);
const retainTimer = setInterval(() => retainLocal(host.db), 60_000);

const app = createRuntimeApp(db, host, {
  secretRoot: config.secretRoot,
  pairing,
  pairingDeps,
  onHaSaved: startHa,
  mcp: {
    registry: mcpRegistry,
    siteId: () => session.siteId,
    apiHttpUrl: config.apiHttpUrl,
    onChanged: () => reportAll(),
  },
  ...(config.testHooks ? { hooks: haLog, gateway, adapterCalls: adapter.calls } : {}),
});
await app.listen({ host: config.listenHost, port: config.listenPort });

const shutdown = () => {
  clearInterval(reportTimer);
  clearInterval(retainTimer);
  host.stop();
  ha?.stop();
  void mcpRegistry.stop();
  gateway.stop();
  void app.close().then(() => db.close());
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
