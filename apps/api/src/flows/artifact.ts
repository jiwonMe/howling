/**
 * Draft를 불변 revision artifact로 고정한다.
 */
import { randomUUID } from "node:crypto";
import {
  NODE_CATALOG_VERSION,
  type RevisionArtifact,
} from "@howling/contracts";
import { artifactDigest } from "./digest.js";

export const connectorsOf = (input: {
  readonly definition: { readonly nodes?: readonly { readonly config?: { readonly adapter?: string } }[] };
  readonly connections: RevisionArtifact["connections"];
}): string[] => {
  const found = new Set<string>();
  for (const item of input.connections) {
    if (item.kind === "ha") {
      found.add("homeassistant");
    }
    if (item.kind === "mcp") {
      found.add("mcp");
    }
  }
  for (const node of input.definition.nodes ?? []) {
    if (node.config?.adapter === "homeassistant") {
      found.add("homeassistant");
    }
    if (node.config?.adapter === "mcp") {
      found.add("mcp");
    }
  }
  return found.size > 0 ? [...found] : ["homeassistant"];
};

export const artifactFromDraft = (input: {
  readonly siteId: string;
  readonly flowId: string;
  readonly revisionId?: string;
  readonly definition: object;
  readonly triggers: RevisionArtifact["triggers"];
  readonly connections: RevisionArtifact["connections"];
  readonly executionPolicy: RevisionArtifact["executionPolicy"];
}): RevisionArtifact => {
  const revisionId = input.revisionId ?? randomUUID();
  const definition = {
    ...input.definition,
    id: input.flowId,
    revision: revisionId,
  } as RevisionArtifact["definition"];
  const requirements = {
    protocolVersion: 1 as const,
    nodeCatalogVersion: NODE_CATALOG_VERSION,
    connectors: connectorsOf({
      definition: definition as unknown as {
        readonly nodes?: readonly { readonly config?: { readonly adapter?: string } }[];
      },
      connections: input.connections,
    }),
  };
  return {
    schemaVersion: 1,
    siteId: input.siteId,
    flowId: input.flowId,
    revisionId,
    definition,
    triggers: input.triggers,
    connections: input.connections,
    requirements,
    executionPolicy: input.executionPolicy,
    artifactDigest: artifactDigest({
      definition: { ...definition, revision: "" },
      triggers: input.triggers,
      connections: input.connections,
      executionPolicy: input.executionPolicy,
      requirements,
    }),
  };
};
