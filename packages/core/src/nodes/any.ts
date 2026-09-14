/**
 * scheduler가 고른 승자 입력만 읽는다.
 * 패배 경로 바인딩은 읽지 않고, 늦은 완료가 승자를 바꾸지 않는다.
 */
import type { NodeImplementation, NodeSpec } from "../contracts/node.js";
import { coreError } from "../contracts/error.js";
import { SUCCESS_PORT } from "./reserved.js";

export const anySpec: NodeSpec = {
  type: "core.any",
  version: 1,
  configSchema: {
    type: "object",
    required: ["inputNames"],
    additionalProperties: false,
    properties: {
      inputNames: {
        type: "array",
        minItems: 1,
        items: { type: "string", minLength: 1 },
      },
    },
  },
  inputSchema: { type: "object" },
  outputSchema: {
    type: "object",
    required: ["source", "value"],
    additionalProperties: false,
    properties: {
      source: { type: "string" },
      value: {},
    },
  },
  control: { inputs: [], outputs: [SUCCESS_PORT], join: "any" },
};

export const anyImplementation: NodeImplementation = {
  start: (context) => {
    if (context.join?.kind !== "any") {
      return {
        kind: "fail",
        error: coreError("INVALID_JOIN", "ANY node is missing selected input"),
      };
    }
    const source = context.join.selectedInput;
    const value = context.inputs[source];
    if (value === undefined) {
      return {
        kind: "fail",
        error: coreError("INVALID_JOIN", `ANY selected input ${source} has no value`),
      };
    }
    return {
      kind: "complete",
      outputs: { source, value },
      activate: [SUCCESS_PORT],
    };
  },
};
