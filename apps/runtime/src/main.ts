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
import { createHaAwareAdapter } from "./ha/adapter.js";
import { startHaConnector, type HaHandle } from "./ha/client.js";
import { createHaCallLog } from "./ha/hooks.js";
import { dispatchHaTriggers } from "./ha/triggers.js";
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
const host = createRuntimeHost({
  db,
  adapter: createHaAwareAdapter({
    fake: createFakeAdapter(),
    ha: () => ha,
    testHooks: config.testHooks,
  }),
});

const gateway = startRuntimeGateway(
  { ...config, runtimeId: session.runtimeId, siteId: session.siteId },
  session.token,
  undefined,
  (envelope) => {
    handleCloudControl(host, gateway, envelope);
  },
  () => {
    flushUnackedSummaries(host, gateway);
  },
);

const reportHa = (status: HaStatus) => {
  gateway.send("connections.snapshot", {
    ha: { status, lastSyncAt: ha?.lastSyncAt() ?? null },
  });
};

const startHa = () => {
  ha?.stop();
  const url = readSecret(config.secretRoot, "ha-url");
  const token = readSecret(config.secretRoot, "ha-token");
  if (!url || !token) {
    return;
  }
  ha = startHaConnector({
    url,
    token,
    onStatus: reportHa,
    onEvent: (event) => dispatchHaTriggers(host, event, false),
    onCall: haLog.record,
  });
};

host.afterCommit = (hint) => {
  try {
    publishRunSummary(host, gateway, hint.runId);
  } catch {
    // 요약 전송 실패는 실행을 멈추지 않는다.
  }
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
startHa();
setInterval(() => {
  if (ha) {
    reportHa(ha.status());
  }
}, 5000);

const app = createRuntimeApp(db, host, {
  secretRoot: config.secretRoot,
  pairing,
  pairingDeps,
  onHaSaved: startHa,
  ...(config.testHooks ? { hooks: haLog, gateway } : {}),
});
await app.listen({ host: config.listenHost, port: config.listenPort });

const shutdown = () => {
  host.stop();
  ha?.stop();
  gateway.stop();
  void app.close().then(() => db.close());
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
