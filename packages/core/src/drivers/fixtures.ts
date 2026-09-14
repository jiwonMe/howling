/**
 * fingerprint+nodeId+순번에 묶인 fixture.
 * adapter·operation·input이 기대와 다르면 실제 adapter로 우회하지 않는다.
 */
import type { EffectRequest, EffectResponse } from "../contracts/effect.js";
import { canonicalizeJson } from "../json/canonical.js";

export interface EffectFixture {
  readonly nodeId: string;
  readonly index: number;
  readonly adapter?: string;
  readonly operation?: string;
  readonly input?: unknown;
  readonly at?: number;
  readonly order?: number;
  readonly response: EffectResponse;
}

export const fixtureKey = (nodeId: string, index: number): string => `${nodeId}:${index}`;

export const matchFixture = (
  request: EffectRequest,
  fixture: EffectFixture,
): { ok: true } | { ok: false; reason: string } => {
  if (fixture.nodeId !== request.nodeId || fixture.index !== request.index) {
    return { ok: false, reason: "fixture key does not match request" };
  }
  if (request.intent.kind === "external") {
    if (fixture.adapter !== undefined && fixture.adapter !== request.intent.adapter) {
      return { ok: false, reason: "fixture adapter does not match request" };
    }
    if (fixture.operation !== undefined && fixture.operation !== request.intent.operation) {
      return { ok: false, reason: "fixture operation does not match request" };
    }
    if (
      fixture.input !== undefined &&
      canonicalizeJson(fixture.input as never) !== canonicalizeJson(request.intent.input)
    ) {
      return { ok: false, reason: "fixture input does not match request" };
    }
  }
  return { ok: true };
};
