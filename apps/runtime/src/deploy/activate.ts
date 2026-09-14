/**
 * Cloud desired.deployment를 로컬 활성 포인터로 만든다.
 */
import { NODE_CATALOG_VERSION, type RevisionArtifact } from "@howling/contracts";
import type { HowlingEngine } from "@howling/core";
import type Database from "better-sqlite3";
import { getDeployment, upsertArtifact } from "../store/artifacts.js";

export const activateArtifact = (
  db: Database.Database,
  engine: HowlingEngine,
  input: {
    readonly deploymentId: string;
    readonly generation: number;
    readonly artifact: RevisionArtifact;
  },
): { status: "active" | "failed" | "ignored"; error?: string } => {
  const current = getDeployment(db, input.artifact.flowId);
  if (current && current.generation > input.generation) {
    return { status: "ignored" };
  }
  if (
    input.artifact.triggers.some((item) => item.kind === "ha.state_changed") &&
    !input.artifact.connections.some((item) => item.kind === "ha")
  ) {
    return { status: "failed", error: "HA connection required" };
  }
  if (input.artifact.requirements.nodeCatalogVersion !== NODE_CATALOG_VERSION) {
    return { status: "failed", error: "node catalog mismatch" };
  }
  const compiled = engine.compile(input.artifact.definition);
  if (!compiled.ok) {
    return {
      status: "failed",
      error: compiled.diagnostics.map((item) => item.message).join("; "),
    };
  }
  upsertArtifact(db, {
    id: input.artifact.revisionId,
    definition: input.artifact.definition,
    triggers: input.artifact.triggers,
    connections: input.artifact.connections,
    generation: input.generation,
  });
  return { status: "active" };
};
