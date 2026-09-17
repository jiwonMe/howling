/**
 * adapter === "device": action은 가상이면 로컬, 집 기기면 HA call_service.
 * read는 로컬 SQLite의 현재 상태를 돌려준다(HA 호출 없음).
 */
import { deviceActionRequestSchema, deviceReadRequestSchema } from "@howling/contracts";
import type { EffectRequest } from "@howling/core";
import type Database from "better-sqlite3";
import type { AdapterCall, AdapterResult, FakeAdapter } from "../effects/fake-adapter.js";
import type { HaEvent } from "../ha/client.js";
import { readDeviceValue } from "./read.js";
import { resolveAction } from "./resolve.js";
import { applyVirtualAction } from "./virtual-apply.js";

const readDevice = (db: Database.Database, input: unknown): AdapterResult => {
  const parsed = deviceReadRequestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      source: "live",
      status: "failed",
      error: { code: "INVALID_DEVICE", message: "deviceId required" },
    };
  }
  const value = readDeviceValue(db, parsed.data.deviceId);
  if (value === undefined) {
    return { source: "live", status: "unknown", reason: "device missing" };
  }
  return { source: "live", status: "succeeded", value };
};

export const createDeviceAwareAdapter = (input: {
  readonly next: FakeAdapter;
  readonly db: Database.Database;
  readonly onVirtualEvent?: (event: HaEvent) => void;
}): FakeAdapter => {
  const calls: AdapterCall[] = input.next.calls;
  return {
    calls,
    execute: async (request: EffectRequest): Promise<AdapterResult> => {
      const intent = request.intent;
      if (intent.kind !== "external" || intent.adapter !== "device") {
        return input.next.execute(request);
      }
      calls.push({
        effectId: request.id,
        adapter: intent.adapter,
        operation: intent.operation,
      });
      if (intent.operation === "read") {
        return readDevice(input.db, intent.input);
      }
      if (intent.operation !== "action") {
        return {
          source: "live",
          status: "failed",
          error: { code: "INVALID_DEVICE", message: "action or read only" },
        };
      }
      const parsed = deviceActionRequestSchema.safeParse(intent.input);
      if (!parsed.success) {
        return {
          source: "live",
          status: "failed",
          error: { code: "INVALID_DEVICE", message: "deviceId and action required" },
        };
      }
      const virtual = applyVirtualAction(input.db, parsed.data);
      if (virtual) {
        input.onVirtualEvent?.(virtual);
        return { source: "live", status: "succeeded", value: { ok: true } };
      }
      const resolved = resolveAction(
        input.db,
        parsed.data.deviceId,
        parsed.data.action,
        parsed.data.data,
      );
      if (!resolved) {
        return { source: "live", status: "unknown", reason: "device missing" };
      }
      return input.next.execute({
        ...request,
        intent: {
          kind: "external",
          adapter: "homeassistant",
          operation: "call_service",
          input: resolved,
        },
      });
    },
  };
};
