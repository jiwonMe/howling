/** 일반 외부 작업 intent를 만들고 result를 기다린다. Core는 adapter를 호출하지 않는다. */
import type { JsonValue } from "../contracts/json.js";
import type { NodeImplementation, NodeSpec } from "../contracts/node.js";
import type { SettledEffectResponse } from "../contracts/effect.js";
import { coreError } from "../contracts/error.js";
import { IN_PORT, SUCCESS_PORT } from "./reserved.js";

export const effectSpec: NodeSpec = {
  type: "core.effect",
  version: 1,
  configSchema: {
    type: "object",
    required: ["adapter", "operation"],
    additionalProperties: false,
    properties: {
      adapter: { type: "string", minLength: 1 },
      operation: { type: "string", minLength: 1 },
    },
  },
  inputSchema: {
    type: "object",
    required: ["request"],
    additionalProperties: false,
    properties: { request: {} },
  },
  outputSchema: {
    type: "object",
    required: ["result"],
    additionalProperties: false,
    properties: { result: {} },
  },
  control: { inputs: [IN_PORT], outputs: [SUCCESS_PORT] },
};

const completeFromResponse = (
  response: SettledEffectResponse,
): ReturnType<NodeImplementation["start"]> => {
  if (response.status === "failed") {
    return { kind: "fail", error: response.error };
  }
  return {
    kind: "complete",
    outputs: { result: response.value },
    activate: [SUCCESS_PORT],
  };
};

export const effectImplementation: NodeImplementation = {
  start: (context) => {
    const adapter = context.config.adapter;
    const operation = context.config.operation;
    if (typeof adapter !== "string" || typeof operation !== "string") {
      return {
        kind: "fail",
        error: coreError("INVALID_NODE_CONFIG", "effect adapter and operation are required"),
      };
    }
    const request: JsonValue = context.inputs.request ?? null;
    return {
      kind: "wait",
      effect: { kind: "external", adapter, operation, input: request },
      continuation: { stage: "awaiting" },
    };
  },
  resume: (_context, _continuation, response) => completeFromResponse(response),
};
