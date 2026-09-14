import { describe, expect, it } from "vitest";
import type { WorkflowDefinition } from "@howling/core";
import { storeArtifact } from "../src/store/artifacts.js";
import { createTestHost, runOf, startDryRun, startRun } from "./helpers.js";

const productMean = (flowId: string): WorkflowDefinition => ({
  schemaVersion: 1,
  id: flowId,
  revision: "rev-product",
  entryNodeId: "input",
  nodes: [
    { id: "input", type: "core.input", version: 1, config: {}, inputs: {} },
    {
      id: "mean",
      type: "analysis.rolling-mean",
      version: 1,
      config: { windowSize: 5 },
      inputs: {
        value: { kind: "output", nodeId: "input", output: "value", path: "/power" },
      },
    },
    {
      id: "condition",
      type: "core.condition",
      version: 1,
      config: { operator: "gt" },
      inputs: {
        left: { kind: "output", nodeId: "mean", output: "mean" },
        right: { kind: "literal", value: 1000 },
      },
    },
    {
      id: "effect",
      type: "core.effect",
      version: 1,
      config: { adapter: "homeassistant", operation: "call_service" },
      inputs: {
        request: {
          kind: "literal",
          value: {
            domain: "input_boolean",
            service: "turn_on",
            service_data: { entity_id: "input_boolean.test_alert" },
          },
        },
      },
    },
  ],
  edges: [
    {
      id: "e-input-mean",
      source: { nodeId: "input", port: "success" },
      target: { nodeId: "mean", port: "in" },
    },
    {
      id: "e-mean-condition",
      source: { nodeId: "mean", port: "success" },
      target: { nodeId: "condition", port: "in" },
    },
    {
      id: "e-condition-effect",
      source: { nodeId: "condition", port: "true" },
      target: { nodeId: "effect", port: "in" },
    },
  ],
});

const effectFixture = {
  nodeId: "effect",
  index: 0,
  adapter: "homeassistant",
  operation: "call_service",
  response: {
    source: "fixture" as const,
    status: "succeeded" as const,
    value: { ok: true },
  },
};

describe("phase 3 product dry-run", () => {
  it("completes an editor-shaped mean flow without adapter calls", async () => {
    const host = createTestHost();
    storeArtifact(host.db, { id: "product-mean", definition: productMean("flow-a") });
    const started = await startDryRun(host, {
      artifactId: "product-mean",
      input: { power: 1400 },
      fixtures: [effectFixture],
    });
    expect(runOf(host, started.runId!).status).toBe("completed");
    expect(host.adapter.calls).toHaveLength(0);
    host.stop();
    host.db.close();
  });

  it("fills missing fixtures from the definition", async () => {
    const host = createTestHost();
    const definition = productMean("flow-c");
    storeArtifact(host.db, { id: "product-fill", definition });
    const started = await startDryRun(host, {
      artifactId: "product-fill",
      input: { power: 1400 },
      fixtures: [],
      definition,
    });
    expect(runOf(host, started.runId!).status).toBe("completed");
    expect(host.adapter.calls).toHaveLength(0);
    host.stop();
    host.db.close();
  });

  it("completes five live runs and calls the adapter once", async () => {
    const host = createTestHost();
    storeArtifact(host.db, {
      id: "product-live",
      definition: productMean("flow-b"),
    });
    for (const [index, power] of [800, 900, 1100, 1200, 1400].entries()) {
      const started = await startRun(host, {
        artifactId: "product-live",
        input: { power },
        idempotencyKey: `live-${String(index)}`,
      });
      expect(runOf(host, started.runId!).status).toBe("completed");
    }
    expect(host.adapter.calls).toHaveLength(1);
    host.stop();
    host.db.close();
  });
});
