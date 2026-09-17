/**
 * 명시된 비교 연산으로 true/false 중 하나만 활성화한다.
 * 숫자 문자열 자동 변환과 임의 eval은 하지 않는다.
 */
import type { JsonValue } from "../contracts/json.js";
import type { NodeImplementation, NodeSpec } from "../contracts/node.js";
import { coreError } from "../contracts/error.js";
import { IN_PORT } from "./reserved.js";

export const CONDITION_OPERATORS = [
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "isTrue",
  "isFalse",
  "in",
  "notIn",
] as const;

export type ConditionOperator = (typeof CONDITION_OPERATORS)[number];

export const conditionSpec: NodeSpec = {
  type: "core.condition",
  version: 1,
  configSchema: {
    type: "object",
    required: ["operator"],
    additionalProperties: false,
    properties: {
      operator: { type: "string", enum: [...CONDITION_OPERATORS] },
    },
  },
  inputSchema: {
    type: "object",
    required: ["left"],
    additionalProperties: false,
    properties: { left: {}, right: {} },
  },
  outputSchema: {
    type: "object",
    required: ["result"],
    additionalProperties: false,
    properties: { result: { type: "boolean" } },
  },
  control: { inputs: [IN_PORT], outputs: ["true", "false"] },
};

const compareNumbers = (
  operator: ConditionOperator,
  left: number,
  right: number,
): boolean => {
  if (operator === "gt") {
    return left > right;
  }
  if (operator === "gte") {
    return left >= right;
  }
  if (operator === "lt") {
    return left < right;
  }
  return left <= right;
};

const sameJson = (left: JsonValue, right: JsonValue): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

/** right는 배열이어야 한다. 원소 비교는 eq와 같은 구조 동등. */
const evaluateMembership = (
  operator: "in" | "notIn",
  left: JsonValue,
  right: JsonValue | undefined,
): { ok: true; result: boolean } | { ok: false; message: string } => {
  if (!Array.isArray(right)) {
    return { ok: false, message: `${operator} requires an array right value` };
  }
  const found = right.some((item) => sameJson(left, item));
  return { ok: true, result: operator === "in" ? found : !found };
};

const evaluateCondition = (
  operator: ConditionOperator,
  left: JsonValue,
  right: JsonValue | undefined,
): { ok: true; result: boolean } | { ok: false; message: string } => {
  if (operator === "in" || operator === "notIn") {
    return evaluateMembership(operator, left, right);
  }
  if (operator === "isTrue") {
    return typeof left === "boolean"
      ? { ok: true, result: left }
      : { ok: false, message: "isTrue requires a boolean left value" };
  }
  if (operator === "isFalse") {
    return typeof left === "boolean"
      ? { ok: true, result: !left }
      : { ok: false, message: "isFalse requires a boolean left value" };
  }
  if (operator === "eq") {
    return { ok: true, result: JSON.stringify(left) === JSON.stringify(right) };
  }
  if (operator === "neq") {
    return { ok: true, result: JSON.stringify(left) !== JSON.stringify(right) };
  }
  if (typeof left !== "number" || typeof right !== "number") {
    return { ok: false, message: "ordered comparison requires two numbers" };
  }
  return { ok: true, result: compareNumbers(operator, left, right) };
};

export const conditionImplementation: NodeImplementation = {
  start: (context) => {
    const operator = context.config.operator;
    if (typeof operator !== "string") {
      return {
        kind: "fail",
        error: coreError("INVALID_NODE_CONFIG", "condition operator is missing"),
      };
    }
    const checked = evaluateCondition(
      operator as ConditionOperator,
      context.inputs.left ?? null,
      context.inputs.right,
    );
    if (!checked.ok) {
      return {
        kind: "fail",
        error: coreError("INVALID_COMPARISON", checked.message),
      };
    }
    return {
      kind: "complete",
      outputs: { result: checked.result },
      activate: [checked.result ? "true" : "false"],
    };
  },
};
