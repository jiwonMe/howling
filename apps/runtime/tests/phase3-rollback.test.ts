import { createEngine, createOfficialRegistry, type WorkflowDefinition } from "@howling/core";
import { NODE_CATALOG_VERSION } from "@howling/contracts";
import { describe, expect, it } from "vitest";
import { activateArtifact } from "../src/deploy/activate.js";
import { getDeployment, upsertArtifact } from "../src/store/artifacts.js";
import { openTestDb } from "./helpers.js";

const definition = (id: string, revision: string): WorkflowDefinition => ({
  schemaVersion: 1,
  id,
  revision,
  entryNodeId: "input",
  nodes: [{ id: "input", type: "core.input", version: 1, config: {}, inputs: {} }],
  edges: [],
});

const artifact = (flowId: string, revisionId: string) => ({
  schemaVersion: 1 as const,
  siteId: "site",
  flowId,
  revisionId,
  definition: definition(flowId, revisionId),
  triggers: [],
  connections: [],
  requirements: {
    protocolVersion: 1 as const,
    nodeCatalogVersion: NODE_CATALOG_VERSION,
    connectors: ["homeassistant"] as const,
  },
  executionPolicy: { mode: "live" as const, captureRaw: false },
  artifactDigest: revisionId,
});

describe("phase 3 rollback epoch", () => {
  it("activates a previous revision as a new generation and epoch", () => {
    const { db } = openTestDb();
    const engine = createEngine({ registry: createOfficialRegistry() });
    upsertArtifact(db, {
      id: "rev-1",
      definition: definition("flow-b", "rev-1"),
      generation: 1,
      stateEpoch: "epoch_1",
    });
    const next = activateArtifact(db, engine, {
      deploymentId: "dep-2",
      generation: 2,
      artifact: artifact("flow-b", "rev-2"),
    });
    expect(next.status).toBe("active");
    expect(getDeployment(db, "flow-b")).toMatchObject({
      artifactId: "rev-2",
      generation: 2,
      stateEpoch: "epoch_2",
    });
    const rolled = activateArtifact(db, engine, {
      deploymentId: "dep-3",
      generation: 3,
      artifact: artifact("flow-b", "rev-1"),
      rollback: true,
      stateEpoch: "reset",
    });
    expect(rolled.status).toBe("active");
    expect(getDeployment(db, "flow-b")).toMatchObject({
      artifactId: "rev-1",
      generation: 3,
      stateEpoch: "epoch_3",
    });
    const kept = activateArtifact(db, engine, {
      deploymentId: "dep-4",
      generation: 4,
      artifact: artifact("flow-b", "rev-1"),
      stateEpoch: "keep",
    });
    expect(kept.status).toBe("active");
    expect(getDeployment(db, "flow-b")).toMatchObject({
      artifactId: "rev-1",
      generation: 4,
      stateEpoch: "epoch_3",
    });
    db.close();
  });
});
