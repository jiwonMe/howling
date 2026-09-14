import { createEngine, createOfficialRegistry, type WorkflowDefinition } from "@howling/core";
import { NODE_CATALOG_VERSION } from "@howling/contracts";
import { describe, expect, it } from "vitest";
import { activateArtifact } from "../src/deploy/activate.js";
import { getDeployment, upsertArtifact } from "../src/store/artifacts.js";
import { openTestDb } from "./helpers.js";

const definition = (id: string): WorkflowDefinition => ({
  schemaVersion: 1,
  id,
  revision: "v1",
  entryNodeId: "input",
  nodes: [{ id: "input", type: "core.input", version: 1, config: {}, inputs: {} }],
  edges: [],
});

describe("deployment generation", () => {
  it("ignores a late older generation", () => {
    const { db } = openTestDb();
    const engine = createEngine({ registry: createOfficialRegistry() });
    upsertArtifact(db, {
      id: "rev-new",
      definition: definition("flow-a"),
      generation: 5,
    });
    const result = activateArtifact(db, engine, {
      deploymentId: "dep-old",
      generation: 3,
      artifact: {
        schemaVersion: 1,
        siteId: "site",
        flowId: "flow-a",
        revisionId: "rev-old",
        definition: { ...definition("flow-a"), revision: "old" },
        triggers: [],
        connections: [],
        requirements: {
          protocolVersion: 1,
          nodeCatalogVersion: NODE_CATALOG_VERSION,
          connectors: ["homeassistant"],
        },
        executionPolicy: { mode: "live", captureRaw: false },
        artifactDigest: "x",
      },
    });
    expect(result.status).toBe("ignored");
    expect(getDeployment(db, "flow-a")?.generation).toBe(5);
    expect(getDeployment(db, "flow-a")?.artifactId).toBe("rev-new");
    db.close();
  });
});
