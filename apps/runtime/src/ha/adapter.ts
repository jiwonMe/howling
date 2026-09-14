/**
 * homeassistant.call_service adapter. dispatchStarted 뒤에만 호출한다.
 */
import type { EffectRequest } from "@howling/core";
import type { AdapterCall, AdapterResult, FakeAdapter } from "../effects/fake-adapter.js";
import type { HaHandle } from "./client.js";

export const createHaAwareAdapter = (input: {
  readonly fake: FakeAdapter;
  readonly ha: () => HaHandle | undefined;
  readonly testHooks: boolean;
}): FakeAdapter => {
  const calls: AdapterCall[] = input.fake.calls;
  return {
    calls,
    execute: async (request: EffectRequest): Promise<AdapterResult> => {
      const intent = request.intent;
      if (intent.kind !== "external") {
        return input.fake.execute(request);
      }
      if (intent.adapter !== "homeassistant") {
        return input.fake.execute(request);
      }
      calls.push({
        effectId: request.id,
        adapter: intent.adapter,
        operation: intent.operation,
      });
      const ha = input.ha();
      if (!ha || ha.status() !== "ready") {
        return {
          source: "live",
          status: "unknown",
          reason: "home assistant is not ready",
        };
      }
      const body = intent.input as {
        domain?: string;
        service?: string;
        service_data?: Record<string, unknown>;
      };
      if (!body.domain || !body.service) {
        return {
          source: "live",
          status: "failed",
          error: { code: "INVALID_HA", message: "domain and service required" },
        };
      }
      try {
        const value = await ha.callService(
          body.domain,
          body.service,
          body.service_data ?? {},
        );
        return { source: "live", status: "succeeded", value: value as never };
      } catch (error) {
        return {
          source: "live",
          status: "unknown",
          reason: error instanceof Error ? error.message : "ha call lost",
        };
      }
    },
  };
};
