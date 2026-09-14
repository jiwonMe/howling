/**
 * 테스트 공용 헬퍼.
 * compile/start/step 실패를 바로 throw 해 단언을 짧게 유지한다.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createEngine } from "../src/engine/create-engine.js";
import { createOfficialRegistry } from "../src/nodes/official.js";
import type {
  CompiledWorkflow,
  ExecutionState,
  JsonValue,
  NodeInstance,
  WorkflowDefinition,
} from "../src/contracts/index.js";

export const engine = createEngine({ registry: createOfficialRegistry() });

export const powerAlertDefinition = (): WorkflowDefinition =>
  JSON.parse(
    readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../examples/power-alert.json"),
      "utf8",
    ),
  ) as WorkflowDefinition;

export const compileOrThrow = (definition: WorkflowDefinition): CompiledWorkflow => {
  const compiled = engine.compile(definition);
  if (!compiled.ok) {
    throw new Error(compiled.diagnostics.map((item) => item.message).join("; "));
  }
  return compiled.plan;
};

export const startOrThrow = (
  plan: CompiledWorkflow,
  input: unknown,
  extra?: Partial<{ runId: string; logicalTime: number; initialState: Record<string, JsonValue> }>,
): ExecutionState => {
  const started = engine.startRun(plan, input as never, {
    runId: extra?.runId ?? "run-1",
    mode: "dryRun",
    logicalTime: extra?.logicalTime ?? 0,
    ...(extra?.initialState === undefined ? {} : { initialState: extra.initialState }),
  });
  if (!started.ok) {
    throw new Error(started.diagnostics.map((item) => item.message).join("; "));
  }
  return started.transition.state;
};

export const stepOrThrow = (
  plan: CompiledWorkflow,
  state: ExecutionState,
): { state: ExecutionState; events: readonly unknown[]; effects: readonly unknown[] } => {
  const stepped = engine.step(plan, state);
  if (!stepped.ok) {
    throw new Error(stepped.diagnostics.map((item) => item.message).join("; "));
  }
  return stepped.transition;
};

export const drainPure = (plan: CompiledWorkflow, state: ExecutionState): ExecutionState => {
  let current = state;
  for (let index = 0; index < 100; index += 1) {
    if (current.readyQueue.length === 0) {
      return current;
    }
    current = stepOrThrow(plan, current).state;
  }
  throw new Error("drain exceeded iteration limit");
};

export const node = (
  id: string,
  type: string,
  inputs: NodeInstance["inputs"] = {},
  config: NodeInstance["config"] = {},
): NodeInstance => ({
  id,
  type,
  version: 1,
  config,
  inputs,
});

export const edge = (
  id: string,
  source: [string, string],
  target: [string, string],
): WorkflowDefinition["edges"][number] => ({
  id,
  source: { nodeId: source[0], port: source[1] },
  target: { nodeId: target[0], port: target[1] },
});

export const workflow = (
  nodes: NodeInstance[],
  edges: WorkflowDefinition["edges"],
  entryNodeId = "input",
): WorkflowDefinition => ({
  schemaVersion: 1,
  id: "test",
  revision: "v1",
  entryNodeId,
  nodes,
  edges,
});
