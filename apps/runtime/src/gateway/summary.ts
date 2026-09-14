/**
 * Run summary를 API로 올린다.
 */
import type { RuntimeHost } from "../coordinator/host.js";
import { listEvents } from "../store/events.js";
import { getRun } from "../store/runs.js";
import { getTriggerByRun } from "../store/triggers.js";
import type { GatewayHandle } from "./client.js";

export const publishRunSummary = (
  host: RuntimeHost,
  gateway: GatewayHandle,
  runId: string,
): void => {
  const run = getRun(host.db, runId);
  if (!run) {
    return;
  }
  const trigger = getTriggerByRun(host.db, runId);
  gateway.send("run.summary", {
    runId,
    flowId: run.flowId,
    revisionId: run.artifactId,
    status: run.status,
    lastSeq: run.lastEventSeq,
    trigger: trigger?.input ?? null,
    events: listEvents(host.db, runId).map((event) => ({
      sequence: event.sequence,
      type: event.type,
      ...("nodeId" in event ? { nodeId: event.nodeId } : {}),
    })),
  });
};
