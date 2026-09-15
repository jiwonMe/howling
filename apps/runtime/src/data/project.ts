/**
 * 선택한 필드만. effect payload·원문 오류는 넣지 않는다.
 */
import type { ObservationField } from "@howling/contracts";
import type { ExecutionEvent } from "@howling/core";
import { asScalar, readPointer } from "./pointer.js";

export const projectFields = (
  event: ExecutionEvent,
  fields: readonly ObservationField[],
  flowId: string,
): Record<string, number | string | boolean | null> => {
  const source = sourceOf(event);
  if (!source) {
    return {};
  }
  const out: Record<string, number | string | boolean | null> = {};
  for (const field of fields) {
    if (field.flowId !== flowId) {
      continue;
    }
    if ("nodeId" in event && event.nodeId !== field.nodeId) {
      continue;
    }
    const scalar = asScalar(readPointer(source, field.pointer));
    if (scalar !== undefined) {
      out[field.id] = scalar;
    }
  }
  return out;
};

const sourceOf = (event: ExecutionEvent): unknown => {
  if (event.type === "node.completed" || event.type === "node.started") {
    return event.outputs ?? event.inputs;
  }
  if (event.type === "node.stateUpdated") {
    return event.nextState;
  }
  return undefined;
};

const SECRET = /token|secret|authorization|password|refresh/i;

export const redactValue = (value: unknown): unknown => {
  if (!value || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(redactValue);
  }
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (SECRET.test(key)) {
      continue;
    }
    out[key] = redactValue(item);
  }
  return out;
};
