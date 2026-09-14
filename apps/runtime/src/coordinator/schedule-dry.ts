/**
 * Dry-run driver 예약. live dispatcher와 wall-clock timer는 쓰지 않는다.
 */
import { createDryRunDriver, type EffectFixture, type ExecutionState } from "@howling/core";
import { getRun } from "../store/runs.js";
import { getTestSessionByRun } from "../store/test-sessions.js";
import { compileArtifact } from "./compile.js";
import type { HostContext } from "./context.js";

export const scheduleDryRun = (ctx: HostContext, state: ExecutionState): void => {
  const session = getTestSessionByRun(ctx.db, state.runId);
  const run = getRun(ctx.db, state.runId);
  const artifactId = session?.artifactId ?? run?.artifactId;
  if (!artifactId) {
    return;
  }
  const fixtures: readonly EffectFixture[] = session?.fixtures ?? [];
  const pending = Object.values(state.effects)
    .filter((record) => record.status === "requested" || record.status === "unknown")
    .map((record) => ({
      id: record.id,
      runId: record.runId,
      nodeId: record.nodeId,
      index: record.index,
      intent: record.intent,
    }));
  const commands = createDryRunDriver({ fixtures }).nextCommands(
    compileArtifact(ctx, artifactId),
    state,
    pending,
  );
  for (const command of commands) {
    void ctx.inbox.enqueue({
      kind: "core_command",
      runId: state.runId,
      command,
    });
  }
};
