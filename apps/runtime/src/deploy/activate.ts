/**
 * Cloud desired.deployment를 로컬 활성 포인터로 만든다.
 */
import { NODE_CATALOG_VERSION, triggerNeedsHa, type RevisionArtifact } from "@howling/contracts";
import type { HowlingEngine } from "@howling/core";
import type Database from "better-sqlite3";
import { assertMcpReady } from "../mcp/deploy.js";
import {
  activatePointer,
  deactivatePointer,
  getDeployment,
  lastGeneration,
  nextStateEpoch,
  storeArtifact,
} from "../store/artifacts.js";

export const activateArtifact = (
  db: Database.Database,
  engine: HowlingEngine,
  input: {
    readonly deploymentId: string;
    readonly generation: number;
    readonly artifact: RevisionArtifact;
    readonly rollback?: boolean;
    readonly deactivate?: boolean;
    readonly stateEpoch?: "reset" | "keep";
  },
): { status: "active" | "failed" | "ignored" | "inactive"; error?: string } => {
  const seen = lastGeneration(db, input.artifact.flowId);
  if (seen !== undefined && seen > input.generation) {
    return { status: "ignored" };
  }
  if (input.deactivate) {
    deactivatePointer(db, input.artifact.flowId, input.generation);
    return { status: "inactive" };
  }
  const current = getDeployment(db, input.artifact.flowId);
  if (
    input.artifact.triggers.some((item) => triggerNeedsHa(item.kind)) &&
    !input.artifact.connections.some((item) => item.kind === "ha")
  ) {
    return { status: "failed", error: "HA connection required" };
  }
  if (input.artifact.requirements.nodeCatalogVersion !== NODE_CATALOG_VERSION) {
    return { status: "failed", error: "node catalog mismatch" };
  }
  const mcpError = assertMcpReady(db, input.artifact);
  if (mcpError) {
    return { status: "failed", error: mcpError };
  }
  const compiled = engine.compile(input.artifact.definition);
  if (!compiled.ok) {
    return {
      status: "failed",
      error: compiled.diagnostics.map((item) => item.message).join("; "),
    };
  }
  storeArtifact(db, {
    id: input.artifact.revisionId,
    definition: input.artifact.definition,
    triggers: input.artifact.triggers,
    connections: input.artifact.connections,
    executionPolicy: input.artifact.executionPolicy,
  });
  activatePointer(db, {
    flowId: input.artifact.flowId,
    artifactId: input.artifact.revisionId,
    generation: input.generation,
    stateEpoch: resolveEpoch(current, input),
  });
  return { status: "active" };
};

const resolveEpoch = (
  current: { artifactId: string; stateEpoch: string } | undefined,
  input: {
    readonly artifact: RevisionArtifact;
    readonly stateEpoch?: "reset" | "keep";
  },
): string => {
  if (
    input.stateEpoch === "keep" &&
    current &&
    current.artifactId === input.artifact.revisionId
  ) {
    return current.stateEpoch;
  }
  return nextStateEpoch(current?.stateEpoch);
};
