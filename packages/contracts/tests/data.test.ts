import { describe, expect, it } from "vitest";
import {
  DEFAULT_DATA_POLICY,
  MCP_TOOL_SCOPES,
  desiredDataSchema,
  detailRequestSchema,
  errorCodes,
  observeBatchSchema,
  rawBatchSchema,
  siteDataPolicySchema,
} from "../src/index.js";

describe("phase 5 data contracts", () => {
  it("defaults captureRaw off and keeps capacity at 1 GiB", () => {
    const parsed = siteDataPolicySchema.parse(DEFAULT_DATA_POLICY);
    expect(parsed.defaultCaptureRaw).toBe(false);
    expect(parsed.capacityBytes).toBe(1024 * 1024 * 1024);
  });

  it("rejects raw batches that are not the raw stream", () => {
    expect(() =>
      rawBatchSchema.parse({
        runtimeId: "rt",
        stream: "summary",
        syncSeq: 1,
        runId: "run",
        flowId: "flow",
        revisionId: "rev",
        capturedAt: "2026-09-15T00:00:00.000Z",
        items: [],
      }),
    ).toThrow();
  });

  it("accepts numeric observe samples only", () => {
    const parsed = observeBatchSchema.parse({
      runtimeId: "rt",
      stream: "observe",
      syncSeq: 2,
      items: [
        {
          fieldId: "power",
          ts: "2026-09-15T00:00:00.000Z",
          value: 1400,
          kind: "sample",
          runId: "run",
          nodeId: "input",
        },
      ],
    });
    expect(parsed.items[0]?.value).toBe(1400);
  });

  it("requires requestId on detail.request", () => {
    const parsed = detailRequestSchema.parse({ requestId: "req", runId: "run" });
    expect(parsed.nodeId).toBeUndefined();
  });

  it("parses desired.data with policy and observations", () => {
    const parsed = desiredDataSchema.parse({
      captureRaw: true,
      policy: DEFAULT_DATA_POLICY,
      observations: {
        fields: [{ id: "power", flowId: "f", nodeId: "input", pointer: "/power" }],
      },
    });
    expect(parsed.observations.fields[0]?.pointer).toBe("/power");
  });

  it("gates get_run_detail with data.read", () => {
    expect(MCP_TOOL_SCOPES.get_run_detail).toEqual(["data.read"]);
    expect(errorCodes.rawUnavailable).toBe("raw_unavailable");
  });
});
