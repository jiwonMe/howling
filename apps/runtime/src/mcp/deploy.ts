/**
 * MCP effect가 있으면 해당 connection이 ready여야 한다.
 */
import { mcpEffectInputSchema, type RevisionArtifact } from "@howling/contracts";
import type Database from "better-sqlite3";
import { getConnection } from "./store.js";

export const assertMcpReady = (
  db: Database.Database,
  artifact: RevisionArtifact,
): string | undefined => {
  const ids = new Set(mcpConnectionIds(artifact));
  for (const id of ids) {
    const row = getConnection(db, id);
    if (!row || row.status !== "ready") {
      return `MCP ${id} is not ready`;
    }
  }
  return undefined;
};

export const mcpConnectionIds = (artifact: RevisionArtifact): readonly string[] => {
  const ids = artifact.connections
    .filter((item) => item.kind === "mcp")
    .map((item) => item.connectionId);
  for (const node of artifact.definition.nodes) {
    if (node.type !== "core.effect" || node.config.adapter !== "mcp") {
      continue;
    }
    const binding = node.inputs.request;
    if (!binding || binding.kind !== "literal") {
      continue;
    }
    const parsed = mcpEffectInputSchema.safeParse(binding.value);
    if (parsed.success) {
      ids.push(parsed.data.connectionId);
    }
  }
  return ids;
};
