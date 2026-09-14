/**
 * Summary journal과 cloud batch. 원본 payload는 올리지 않는다.
 */
import { getRuntimeId } from "../db/identity.js";
import type { RuntimeHost } from "../coordinator/host.js";
import { listEvents } from "../store/events.js";
import { getRun } from "../store/runs.js";
import { getTriggerByRun } from "../store/triggers.js";
import { appendSummaryJournal, listUnackedSummary } from "../store/summary-journal.js";
import type { GatewayHandle } from "./client.js";

export const publishRunSummary = (
  host: RuntimeHost,
  gateway: GatewayHandle,
  runId: string,
): void => {
  const batch = buildBatch(host, gateway, runId);
  if (!batch) {
    return;
  }
  gateway.send("run.summary", {
    runId: batch.runId,
    flowId: batch.flowId,
    revisionId: batch.revisionId,
    status: batch.status,
    lastSeq: batch.lastSeq,
    trigger: batch.trigger,
    events: batch.items,
  });
  try {
    const syncSeq = appendSummaryJournal(host.db, runId, batch);
    gateway.send("summary.batch", { ...batch, syncSeq });
  } catch {
    // journal 실패가 실행 루프를 멈추면 안 된다.
  }
};

export const flushUnackedSummaries = (
  host: RuntimeHost,
  gateway: GatewayHandle,
): void => {
  for (const row of listUnackedSummary(host.db)) {
    const item = row.item as { syncSeq?: number };
    gateway.send("summary.batch", { ...asRecord(row.item), syncSeq: row.syncSeq });
    void item;
  }
};

const buildBatch = (
  host: RuntimeHost,
  gateway: GatewayHandle,
  runId: string,
) => {
  const run = getRun(host.db, runId);
  if (!run) {
    return undefined;
  }
  const trigger = getTriggerByRun(host.db, runId);
  return {
    runtimeId: gateway.runtimeId() ?? getRuntimeId(host.db) ?? "runtime_dev",
    stream: "summary" as const,
    runId,
    flowId: run.flowId,
    revisionId: run.artifactId,
    status: run.status,
    runMode: run.runMode,
    lastSeq: run.lastEventSeq,
    trigger: trigger?.input ?? run.snapshot.state.runInput ?? null,
    items: listEvents(host.db, runId).map((event) => ({
      sequence: event.sequence,
      type: event.type,
      ...("nodeId" in event && typeof event.nodeId === "string"
        ? { nodeId: event.nodeId }
        : {}),
      ...("status" in event && typeof event.status === "string"
        ? { status: event.status }
        : {}),
    })),
  };
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};
