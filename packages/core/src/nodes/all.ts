/**
 * 활성 입력만 values에 넣는다.
 * skipped 입력은 기다리지 않고 가짜 값으로 채우지 않는다.
 */
import type { JsonObject } from "../contracts/json.js";
import type { NodeImplementation, NodeSpec } from "../contracts/node.js";
import { SUCCESS_PORT } from "./reserved.js";

export const allSpec: NodeSpec = {
  type: "core.all",
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
    required: ["values"],
    additionalProperties: false,
    properties: { values: { type: "object" } },
  },
  control: { inputs: [], outputs: [SUCCESS_PORT], join: "all" },
};

export const allImplementation: NodeImplementation = {
  start: (context) => {
    const values: { [key: string]: import("../contracts/json.js").JsonValue } = {};
    const active = context.join?.kind === "all" ? context.join.activeInputs : [];
    for (const name of active) {
      const value = context.inputs[name];
      if (value !== undefined) {
        values[name] = value;
      }
    }
    return {
      kind: "complete",
      outputs: { values: values as JsonObject },
      activate: [SUCCESS_PORT],
    };
  },
};
