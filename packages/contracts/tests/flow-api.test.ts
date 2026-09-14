import { describe, expect, it } from "vitest";
import {
  runCommandRequestSchema,
  runStartPayloadSchema,
  summaryBatchSchema,
  testSessionRequestSchema,
} from "../src/index.js";

describe("phase 3 contracts", () => {
  it("defaults live runMode on run.start", () => {
    const parsed = runStartPayloadSchema.parse({
      artifactId: "rev_1",
      flowId: "flow_1",
      input: { power: 1400 },
      mode: "auto",
      idempotencyKey: "k1",
    });
    expect(parsed.runMode).toBe("live");
  });

  it("accepts a draft test session", () => {
    const parsed = testSessionRequestSchema.parse({
      source: "draft",
      input: { power: 1400 },
      fixtures: [
        {
          nodeId: "effect",
          index: 0,
          adapter: "homeassistant",
          operation: "call_service",
          response: { source: "fixture", status: "succeeded", value: { ok: true } },
        },
      ],
      idempotencyKey: "session-1",
    });
    expect(parsed.progression).toBe("auto");
    expect(parsed.fixtures).toHaveLength(1);
  });

  it("accepts a fixture command", () => {
    const parsed = runCommandRequestSchema.parse({
      type: "fixture",
      commandId: "cmd-1",
      effectId: "eff-1",
      response: { source: "fixture", status: "succeeded", value: { ok: true } },
    });
    expect(parsed.type).toBe("fixture");
  });

  it("accepts a summary batch without raw payload", () => {
    const parsed = summaryBatchSchema.parse({
      runtimeId: "runtime_dev",
      stream: "summary",
      syncSeq: 1,
      runId: "run_1",
      flowId: "flow_1",
      revisionId: "rev_1",
      status: "running",
      lastSeq: 2,
      trigger: { power: 1400 },
      items: [{ sequence: 1, type: "run.started" }],
    });
    expect(parsed.items[0]?.type).toBe("run.started");
  });
});
