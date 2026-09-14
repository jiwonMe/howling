/**
 * run을 시작한다.
 * 입력과 초기 분석 상태는 복사만 하고, entry만 ready에 넣는다.
 */
import type { CompiledWorkflow } from "../contracts/compiled.js";
import { diagnostic } from "../contracts/diagnostic.js";
import type { StartRunOptions, TransitionResult } from "../contracts/engine.js";
import type { JsonValue } from "../contracts/json.js";
import type { ExecutionState, NodeRuntimeState } from "../contracts/state.js";
import { cloneJson, tryCloneJson } from "../json/clone.js";
import { createCollector, emit, sealEvents } from "./event-log.js";
import { nodeExecutionId, sortReadyQueue } from "./immutable.js";

const emptyNodes = (plan: CompiledWorkflow, runId: string): Record<string, NodeRuntimeState> => {
  const nodes: Record<string, NodeRuntimeState> = {};
  for (const nodeId of Object.keys(plan.nodes)) {
    nodes[nodeId] = {
      status: nodeId === plan.entryNodeId ? "ready" : "idle",
      executionId: nodeExecutionId(runId, nodeId),
      effectIndex: 0,
    };
  }
  return nodes;
};

const emptyEdges = (plan: CompiledWorkflow): Record<string, "pending"> => {
  const edges: Record<string, "pending"> = {};
  for (const edgeId of Object.keys(plan.edges)) {
    edges[edgeId] = "pending";
  }
  return edges;
};

export const startRun = (
  plan: CompiledWorkflow,
  input: JsonValue,
  options: StartRunOptions,
): TransitionResult => {
  const clonedInput = tryCloneJson(input);
  if (!clonedInput.ok) {
    return {
      ok: false,
      state: emptyFailedState(plan, options),
      diagnostics: [diagnostic("INVALID_JSON", clonedInput.message)],
    };
  }
  const initialState = cloneInitialState(options.initialState);
  const state: ExecutionState = {
    schemaVersion: 1,
    snapshotVersion: 1,
    runId: options.runId,
    workflowId: plan.definition.id,
    revision: plan.definition.revision,
    workflowFingerprint: plan.fingerprint,
    nodeVersions: { ...plan.nodeVersions },
    mode: options.mode,
    status: "running",
    logicalTime: options.logicalTime,
    runInput: clonedInput.value,
    nodes: emptyNodes(plan, options.runId),
    outputs: {},
    resolvedInputs: {},
    continuations: {},
    proposedState: {},
    initialState,
    inputBindings: Object.fromEntries(
      Object.entries(plan.nodes).map(([nodeId, node]) => [nodeId, node.instance.inputs]),
    ),
    edges: emptyEdges(plan),
    readyQueue: sortReadyQueue([plan.entryNodeId], plan.topoRank),
    effects: {},
    appliedCommandIds: [],
    commandDigests: {},
    lastEventSeq: 0,
    paused: false,
    cancelled: false,
    anyWinners: {},
  };
  const collector = createCollector(state);
  emit(collector, state, { type: "run.started", status: "running" });
  emit(collector, state, {
    type: "node.ready",
    nodeId: plan.entryNodeId,
    nodeExecutionId: nodeExecutionId(options.runId, plan.entryNodeId),
    status: "ready",
  });
  return {
    ok: true,
    transition: { state: sealEvents(state, collector), events: collector.events, effects: [] },
  };
};

const cloneInitialState = (
  initial: Readonly<Record<string, JsonValue>> | undefined,
): Record<string, JsonValue> => {
  if (initial === undefined) {
    return {};
  }
  return cloneJson(initial as unknown as JsonValue) as Record<string, JsonValue>;
};

const emptyFailedState = (
  plan: CompiledWorkflow,
  options: StartRunOptions,
): ExecutionState => ({
  schemaVersion: 1,
  snapshotVersion: 1,
  runId: options.runId,
  workflowId: plan.definition.id,
  revision: plan.definition.revision,
  workflowFingerprint: plan.fingerprint,
  nodeVersions: { ...plan.nodeVersions },
  mode: options.mode,
  status: "failed",
  logicalTime: options.logicalTime,
  runInput: null,
  nodes: {},
  outputs: {},
  resolvedInputs: {},
  continuations: {},
  proposedState: {},
  initialState: {},
  inputBindings: {},
  edges: {},
  readyQueue: [],
  effects: {},
    appliedCommandIds: [],
    commandDigests: {},
    lastEventSeq: 0,
    paused: false,
    cancelled: false,
    anyWinners: {},
  });
