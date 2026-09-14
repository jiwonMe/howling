import { describe, expect, it } from "vitest";
import {
  parseRuntimeEnvelope,
  runtimeEnvelopeSchema,
} from "../src/runtime/envelope.js";

const valid = {
  protocolVersion: 1 as const,
  messageId: "msg_1",
  runtimeId: "runtime_dev",
  siteId: "site_dev",
  connectionGeneration: 1,
  type: "hello",
  payload: { protocolVersion: 1, capabilities: { connectors: [] } },
};

describe("runtimeEnvelopeSchema", () => {
  it("accepts a protocol v1 envelope", () => {
    expect(parseRuntimeEnvelope(valid)).toEqual(valid);
  });

  it("accepts optional correlation and expiry", () => {
    const withOptional = {
      ...valid,
      correlationId: "op_1",
      expiresAt: "2026-09-14T10:00:00.000Z",
    };
    expect(runtimeEnvelopeSchema.parse(withOptional)).toEqual(withOptional);
  });

  it("rejects a missing message id", () => {
    const { messageId: _ignored, ...rest } = valid;
    expect(() => runtimeEnvelopeSchema.parse(rest)).toThrow();
  });

  it("rejects protocolVersion other than 1", () => {
    expect(() =>
      runtimeEnvelopeSchema.parse({ ...valid, protocolVersion: 2 }),
    ).toThrow();
  });
});
