/**
 * @howling/core 공개 진입점.
 * Host는 여기 export만 사용한다. React·HA·MCP 의존성은 넣지 않는다.
 */
export { createEngine } from "./engine/create-engine.js";
export type { CreateEngineOptions } from "./engine/create-engine.js";
export { createRegistry } from "./registry/create-registry.js";
export type { MutableNodeRegistry, NodeRegistry } from "./registry/create-registry.js";
export { createOfficialRegistry, registerOfficialNodes } from "./nodes/official.js";
export { createDryRunDriver } from "./drivers/dry-run.js";
export type { DryRunDriverOptions } from "./drivers/dry-run.js";
export { createLiveDriver } from "./drivers/live.js";
export type { LiveDriverAdapters } from "./drivers/live.js";
export type { EffectFixture } from "./drivers/fixtures.js";
export { compileWorkflow } from "./compiler/compile.js";

export type {
  CompileResult,
  CompiledWorkflow,
  ControlEdge,
  CoreError,
  Diagnostic,
  DriverRunResult,
  EffectIntent,
  EffectRequest,
  EffectResponse,
  EngineCommand,
  EngineDriver,
  ExecutionEvent,
  ExecutionSnapshot,
  ExecutionState,
  HowlingEngine,
  InputBinding,
  JsonObject,
  JsonValue,
  NodeImplementation,
  NodeSpec,
  StartRunOptions,
  Transition,
  TransitionResult,
  WorkflowDefinition,
} from "./contracts/index.js";
