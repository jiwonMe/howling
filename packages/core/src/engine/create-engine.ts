/** registry를 고정한 facade. 실행 중 구현을 바꾸지 않는다. */
import { compileWorkflow } from "../compiler/compile.js";
import type { HowlingEngine } from "../contracts/engine.js";
import { runWithDriver } from "../drivers/run.js";
import type { NodeRegistry } from "../registry/create-registry.js";
import { applyCommand } from "../runtime/apply-command.js";
import { restoreSnapshot, snapshotState } from "../runtime/snapshot.js";
import { startRun } from "../runtime/start-run.js";
import { stepRun } from "../runtime/step.js";

export interface CreateEngineOptions {
  readonly registry: NodeRegistry;
}

export const createEngine = (options: CreateEngineOptions): HowlingEngine => ({
  compile: (definition) => compileWorkflow(definition, options.registry),
  startRun: (plan, input, startOptions) => startRun(plan, input, startOptions),
  step: (plan, state) => stepRun(options.registry, plan, state),
  applyCommand: (plan, state, command) => applyCommand(options.registry, plan, state, command),
  run: (plan, state, driver) => runWithDriver(options.registry, plan, state, driver),
  snapshot: (state) => snapshotState(state),
  restore: (plan, snapshot) => restoreSnapshot(plan, snapshot),
});
