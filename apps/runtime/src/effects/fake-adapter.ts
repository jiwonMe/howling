/**
 * 테스트용 외부 adapter. 호출 횟수를 기록한다.
 */
import type { EffectRequest, EffectResponse } from "@howling/core";

export type AdapterCall = {
  readonly effectId: string;
  readonly adapter: string;
  readonly operation: string;
};

export type AdapterResult =
  | EffectResponse
  | { readonly kind: "crash" }
  | { readonly kind: "hang" };

export interface FakeAdapter {
  readonly calls: AdapterCall[];
  readonly execute: (request: EffectRequest) => Promise<AdapterResult>;
}

export const createFakeAdapter = (
  handler?: (request: EffectRequest) => AdapterResult | Promise<AdapterResult>,
): FakeAdapter => {
  const calls: AdapterCall[] = [];
  return {
    calls,
    execute: async (request) => {
      const intent = request.intent;
      if (intent.kind !== "external") {
        return {
          source: "live",
          status: "failed",
          error: { code: "NOT_EXTERNAL", message: "timer is not an adapter call" },
        };
      }
      calls.push({
        effectId: request.id,
        adapter: intent.adapter,
        operation: intent.operation,
      });
      if (handler) {
        return handler(request);
      }
      return {
        source: "live",
        status: "succeeded",
        value: { accepted: true },
      };
    },
  };
};
