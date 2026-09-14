/**
 * snapshot 왕복.
 * fingerprint·노드 버전이 다르면 거부하고, pending effect를 새로 발행하지 않는다.
 */
import type { CompiledWorkflow } from "../contracts/compiled.js";
import { diagnostic } from "../contracts/diagnostic.js";
import type { TransitionResult } from "../contracts/engine.js";
import type { ExecutionSnapshot, ExecutionState } from "../contracts/state.js";
import { cloneJson, tryCloneJson } from "../json/clone.js";

export const snapshotState = (state: ExecutionState): ExecutionSnapshot => ({
  snapshotVersion: 1,
  state: cloneJson(state as unknown as import("../contracts/json.js").JsonValue) as unknown as ExecutionState,
});

export const restoreSnapshot = (
  plan: CompiledWorkflow,
  snapshot: ExecutionSnapshot,
): TransitionResult => {
  if (snapshot.snapshotVersion !== 1) {
    return {
      ok: false,
      state: snapshot.state,
      diagnostics: [diagnostic("INVALID_SNAPSHOT", "unsupported snapshot version")],
    };
  }
  const cloned = tryCloneJson(snapshot.state);
  if (!cloned.ok) {
    return {
      ok: false,
      state: snapshot.state,
      diagnostics: [diagnostic("INVALID_SNAPSHOT", cloned.message)],
    };
  }
  const state = cloned.value as unknown as ExecutionState;
  if (state.workflowFingerprint !== plan.fingerprint) {
    return {
      ok: false,
      state,
      diagnostics: [diagnostic("INVALID_SNAPSHOT", "snapshot fingerprint does not match plan")],
    };
  }
  for (const [nodeId, version] of Object.entries(plan.nodeVersions)) {
    if (state.nodeVersions[nodeId] !== version) {
      return {
        ok: false,
        state,
        diagnostics: [diagnostic("INVALID_SNAPSHOT", `node version mismatch for ${nodeId}`)],
      };
    }
  }
  return { ok: true, transition: { state, events: [], effects: [] } };
};
