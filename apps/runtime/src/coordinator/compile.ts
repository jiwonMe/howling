/**
 * Artifact compile 캐시와 snapshot 복원.
 */
import type { CompiledWorkflow, ExecutionState } from "@howling/core";
import { getArtifact } from "../store/artifacts.js";
import type { RunRow } from "../store/runs.js";
import type { HostContext } from "./context.js";
import { HostError } from "./errors.js";

export const compileArtifact = (
  ctx: HostContext,
  artifactId: string,
): CompiledWorkflow => {
  const cached = ctx.plans.get(artifactId);
  if (cached) {
    return cached;
  }
  const artifact = getArtifact(ctx.db, artifactId);
  if (!artifact) {
    throw new HostError("NOT_FOUND", `artifact ${artifactId} not found`);
  }
  const compiled = ctx.engine.compile(artifact.definition);
  if (!compiled.ok) {
    throw new HostError(
      "FAILED",
      compiled.diagnostics.map((item) => item.message).join("; "),
    );
  }
  ctx.plans.set(artifactId, compiled.plan);
  return compiled.plan;
};

export const restoreRun = (
  ctx: HostContext,
  run: RunRow,
): { readonly plan: CompiledWorkflow; readonly state: ExecutionState } => {
  const plan = compileArtifact(ctx, run.artifactId);
  const restored = ctx.engine.restore(plan, run.snapshot);
  if (!restored.ok) {
    throw new HostError(
      "FAILED",
      restored.diagnostics.map((item) => item.message).join("; "),
    );
  }
  return { plan, state: restored.transition.state };
};
