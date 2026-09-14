/**
 * Draft를 불변 revision artifact로 고정한다.
 */
import { randomUUID } from "node:crypto";
import {
  NODE_CATALOG_VERSION,
  type RevisionArtifact,
} from "@howling/contracts";
import { artifactDigest } from "./digest.js";

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
    connectors: ["homeassistant"] as const,
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
