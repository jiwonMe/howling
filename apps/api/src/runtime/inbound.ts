/**
 * Runtime가 올린 배포·실행·연결 상태.
 */
import {
  activationResultSchema,
  connectionsSnapshotSchema,
  runSummaryPayloadSchema,
  summaryBatchSchema,
  type RuntimeEnvelope,
} from "@howling/contracts";
import type pg from "pg";
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
  if (envelope.type === "connections.snapshot") {
    const payload = connectionsSnapshotSchema.parse(envelope.payload);
    await pool.query(
      `UPDATE runtime_registrations
       SET capabilities = COALESCE(capabilities, '{}'::jsonb) || $2::jsonb
       WHERE runtime_id = $1`,
      [envelope.runtimeId, JSON.stringify({ ha: payload.ha, connectors: ["homeassistant"] })],
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
