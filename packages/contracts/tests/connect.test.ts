import { describe, expect, it } from "vitest";
import {
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_TIMEOUT_MS,
  heartbeatPayloadSchema,
  helloPayloadSchema,
} from "../src/runtime/connect.js";
import { reservedRuntimeMessageTypes } from "../src/runtime/types.js";

describe("connect payloads", () => {
  it("parses hello with empty connectors", () => {
    const payload = {
      protocolVersion: 1 as const,
      capabilities: { connectors: [] },
    };
    expect(helloPayloadSchema.parse(payload)).toEqual(payload);
  });

  it("parses heartbeat sentAt", () => {
    const payload = { sentAt: "2026-09-14T10:00:00.000Z" };
    expect(heartbeatPayloadSchema.parse(payload)).toEqual(payload);
  });

  it("keeps heartbeat 15s / timeout 45s", () => {
    expect(HEARTBEAT_INTERVAL_MS).toBe(15_000);
    expect(HEARTBEAT_TIMEOUT_MS).toBe(45_000);
  });

  it("reserves later message names without implementing them", () => {
    expect(reservedRuntimeMessageTypes).toContain("desired.deployment");
    expect(reservedRuntimeMessageTypes).toContain("hello");
  });
});
