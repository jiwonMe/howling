/**
 * 최근 N개 숫자의 평균.
 * 시간 윈도우·late event·스트림 수집은 범위 밖이다.
 */
import type { JsonValue } from "../contracts/json.js";
import type { NodeImplementation, NodeSpec } from "../contracts/node.js";
import { coreError } from "../contracts/error.js";
import { IN_PORT, SUCCESS_PORT } from "./reserved.js";

export const rollingMeanSpec: NodeSpec = {
  type: "analysis.rolling-mean",
  version: 1,
  configSchema: {
    type: "object",
    required: ["windowSize"],
    additionalProperties: false,
    properties: { windowSize: { type: "integer", minimum: 1 } },
  },
  inputSchema: {
    type: "object",
    required: ["value"],
    additionalProperties: false,
    properties: { value: { type: "number" } },
  },
  outputSchema: {
    type: "object",
    required: ["mean", "count"],
    additionalProperties: false,
    properties: {
      mean: { type: "number" },
      count: { type: "integer" },
    },
  },
  stateSchema: {
    type: "array",
    items: { type: "number" },
  },
  control: { inputs: [IN_PORT], outputs: [SUCCESS_PORT] },
};

const readHistory = (previous: JsonValue | undefined): number[] => {
  if (previous === undefined) {
    return [];
  }
  if (!Array.isArray(previous) || !previous.every((item) => typeof item === "number")) {
    return [];
  }
  return [...previous];
};

export const rollingMeanImplementation: NodeImplementation = {
  start: (context) => {
    const windowSize = context.config.windowSize;
    const value = context.inputs.value;
    if (typeof windowSize !== "number" || typeof value !== "number") {
      return {
        kind: "fail",
        error: coreError("INPUT_SCHEMA_MISMATCH", "rolling-mean requires numeric value"),
      };
    }
    const history = readHistory(context.previousState);
    history.push(value);
    const window = history.slice(Math.max(0, history.length - windowSize));
    const total = window.reduce((sum, item) => sum + item, 0);
    return {
      kind: "complete",
      outputs: {
        mean: window.length === 0 ? 0 : total / window.length,
        count: window.length,
      },
      nextState: window,
      activate: [SUCCESS_PORT],
    };
  },
};
