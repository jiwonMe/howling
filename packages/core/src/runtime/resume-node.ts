/** 대기 노드를 같은 node execution으로 재개한다. 해석된 입력과 continuation을 재사용한다. */
import type { CompiledWorkflow } from "../contracts/compiled.js";
import { coreError } from "../contracts/error.js";
import type { SettledEffectResponse } from "../contracts/effect.js";
import type { NodeOutcome } from "../contracts/node.js";
import type { ExecutionState } from "../contracts/state.js";
import type { NodeRegistry } from "../registry/create-registry.js";
import { applyComplete, applyFail, applyWait } from "./apply-outcome.js";
import type { EventCollector } from "./event-log.js";
import { validateOutputs } from "./evaluate-node.js";
import { buildNodeContext } from "./evaluate-node.js";

export const resumeWaitingNode = (
  registry: NodeRegistry,
  plan: CompiledWorkflow,
  state: ExecutionState,
  collector: EventCollector,
  nodeId: string,
  response: SettledEffectResponse,
) => {
  const node = plan.nodes[nodeId];
  const registered = node
    ? registry.get(node.instance.type, node.instance.version)
    : undefined;
  const resume = registered?.implementation.resume;
  const inputs = state.resolvedInputs[nodeId];
  const continuation = state.continuations[nodeId];
  const context = inputs === undefined ? undefined : buildNodeContext(plan, state, nodeId, inputs);
  if (resume === undefined || context === undefined || continuation === undefined) {
    return applyFail(plan, state, collector, nodeId, {
      code: "INVALID_NODE_CONFIG",
      message: "waiting node cannot resume",
    });
  }
  let outcome: NodeOutcome;
  try {
    outcome = resume(context, continuation, response);
  } catch (error) {
    outcome = {
      kind: "fail",
      error: coreError("NODE_EXCEPTION", error instanceof Error ? error.message : "resume failed"),
    };
  }
  if (outcome.kind === "complete") {
    outcome = validateOutputs(plan, nodeId, outcome.outputs) ?? outcome;
  }
  if (outcome.kind === "complete") {
    return applyComplete(plan, state, collector, nodeId, outcome);
  }
  if (outcome.kind === "fail") {
    return applyFail(plan, state, collector, nodeId, outcome.error);
  }
  return applyWait(plan, state, collector, nodeId, outcome);
};
