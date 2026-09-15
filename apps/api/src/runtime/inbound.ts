/**
 * Runtime가 올린 배포·실행·연결 상태.
 */
import {
  activationResultSchema,
  connectionsSnapshotSchema,
  deviceCreateResultSchema,
  deviceIntegrateResultSchema,
  devicesSnapshotSchema,
  observeBatchSchema,
  rawBatchSchema,
  runSummaryPayloadSchema,
  summaryBatchSchema,
  type RuntimeEnvelope,
} from "@howling/contracts";
import type pg from "pg";
import { acceptDetailResponse } from "../data/detail.js";
import { insertObserveSamples } from "../data/store.js";
import { appendStreamRow } from "../data/streams.js";
import { acceptDeviceCreated } from "../devices/create.js";
import { acceptDeviceIntegrated } from "../devices/integrate.js";
import { replaceSiteDevices, upsertSiteDevice } from "../devices/store.js";
import { setDeploymentStatus } from "../flows/store.js";
import { appendSummaryBatch } from "../flows/journal.js";
import { upsertRunSummary } from "../flows/runs.js";

export const handleRuntimeControl = async (
  pool: pg.Pool,
  envelope: RuntimeEnvelope,
): Promise<void> => {
  try {
    await dispatchRuntimeControl(pool, envelope);
  } catch {
    // 한 메시지 오류가 소켓을 끊으면 이후 summary가 유실된다.
  }
};

const dispatchRuntimeControl = async (
  pool: pg.Pool,
  envelope: RuntimeEnvelope,
): Promise<void> => {
  if (envelope.type === "activation.result") {
    const payload = activationResultSchema.parse(envelope.payload);
    await setDeploymentStatus(
      pool,
      payload.deploymentId,
      payload.status === "active" ? "active" : "failed",
      payload.error,
    );
    return;
  }
  if (envelope.type === "detail.response") {
    acceptDetailResponse(envelope.payload);
    return;
  }
  if (envelope.type === "raw.batch") {
    const parsed = rawBatchSchema.safeParse(envelope.payload);
    if (!parsed.success) {
      return;
    }
    await appendStreamRow(pool, {
      siteId: envelope.siteId,
      runtimeId: envelope.runtimeId,
      stream: "raw",
      syncSeq: parsed.data.syncSeq,
      runId: parsed.data.runId,
      item: parsed.data,
      tombstone: parsed.data.tombstone ?? false,
    });
    return;
  }
  if (envelope.type === "observe.batch") {
    const parsed = observeBatchSchema.safeParse(envelope.payload);
    if (!parsed.success) {
      return;
    }
    await appendStreamRow(pool, {
      siteId: envelope.siteId,
      runtimeId: envelope.runtimeId,
      stream: "observe",
      syncSeq: parsed.data.syncSeq,
      runId: parsed.data.items[0]?.runId ?? null,
      item: parsed.data,
      tombstone: parsed.data.tombstone ?? false,
    });
    if (!parsed.data.tombstone) {
      await insertObserveSamples(
        pool,
        envelope.siteId,
        parsed.data.items.map((item) => ({
          fieldId: item.fieldId,
          ts: item.ts,
          value: item.value,
          kind: item.kind,
          ...(item.runId ? { runId: item.runId } : {}),
          ...(item.nodeId ? { nodeId: item.nodeId } : {}),
        })),
      );
    }
    return;
  }
  if (envelope.type === "summary.batch") {
    const parsed = summaryBatchSchema.safeParse(envelope.payload);
    if (!parsed.success) {
      return;
    }
    const payload = parsed.data;
    await appendSummaryBatch(pool, envelope.siteId, envelope.runtimeId, {
      runtimeId: payload.runtimeId,
      stream: "summary",
      syncSeq: payload.syncSeq,
      runId: payload.runId,
      flowId: payload.flowId,
      revisionId: payload.revisionId,
      status: payload.status,
      lastSeq: payload.lastSeq,
      trigger: payload.trigger ?? null,
      items: payload.items.map((item) => ({
        sequence: item.sequence,
        type: item.type,
        ...(item.nodeId ? { nodeId: item.nodeId } : {}),
        ...(item.status ? { status: item.status } : {}),
      })),
      ...(payload.runMode ? { runMode: payload.runMode } : {}),
    });
    return;
  }
  if (envelope.type === "run.summary") {
    const parsed = runSummaryPayloadSchema.safeParse(sanitizeSummary(envelope.payload));
    if (!parsed.success) {
      return;
    }
    const payload = parsed.data;
    await upsertRunSummary(pool, envelope.siteId, {
      ...payload,
      trigger: payload.trigger ?? null,
      events: payload.events,
    });
    return;
  }
  if (envelope.type === "devices.integrated") {
    const parsed = deviceIntegrateResultSchema.safeParse(envelope.payload);
    if (!parsed.success) {
      return;
    }
    for (const device of parsed.data.devices ?? []) {
      await upsertSiteDevice(pool, envelope.siteId, device);
    }
    acceptDeviceIntegrated(parsed.data);
    return;
  }
  if (envelope.type === "devices.created") {
    const parsed = deviceCreateResultSchema.safeParse(envelope.payload);
    if (!parsed.success) {
      return;
    }
    if (parsed.data.device) {
      await upsertSiteDevice(pool, envelope.siteId, parsed.data.device);
    }
    acceptDeviceCreated(parsed.data);
    return;
  }
  if (envelope.type === "devices.snapshot") {
    const parsed = devicesSnapshotSchema.safeParse(envelope.payload);
    if (!parsed.success) {
      return;
    }
    await replaceSiteDevices(pool, envelope.siteId, parsed.data.devices);
    return;
  }
  if (envelope.type === "connections.snapshot") {
    const parsed = connectionsSnapshotSchema.safeParse(envelope.payload);
    if (!parsed.success) {
      return;
    }
    const payload = parsed.data;
    const connectors = ["homeassistant"];
    if (payload.mcp && payload.mcp.servers.length > 0) {
      connectors.push("mcp");
    }
    await pool.query(
      `UPDATE runtime_registrations
       SET capabilities = COALESCE(capabilities, '{}'::jsonb) || $2::jsonb
       WHERE runtime_id = $1`,
      [
        envelope.runtimeId,
        JSON.stringify({
          ha: payload.ha,
          connectors,
          ...(payload.mcp ? { mcp: payload.mcp } : {}),
        }),
      ],
    );
  }
};

const sanitizeSummary = (payload: unknown) => {
  if (!payload || typeof payload !== "object") {
    return payload;
  }
  const value = payload as {
    events?: unknown;
    trigger?: unknown;
  };
  const events = Array.isArray(value.events)
    ? value.events.flatMap((item) => {
        if (!item || typeof item !== "object") {
          return [];
        }
        const event = item as { sequence?: unknown; type?: unknown; nodeId?: unknown };
        if (typeof event.sequence !== "number" || typeof event.type !== "string") {
          return [];
        }
        return [
          {
            sequence: event.sequence,
            type: event.type,
            ...(typeof event.nodeId === "string" ? { nodeId: event.nodeId } : {}),
          },
        ];
      })
    : [];
  return { ...value, trigger: value.trigger ?? null, events };
};
