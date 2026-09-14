/**
 * 논리 시간 dueAt의 timer effect.
 * 시간 진행만으로 하류를 실행하지 않는다. command가 해소해야 한다.
 */
import type { NodeImplementation, NodeSpec } from "../contracts/node.js";
import type { SettledEffectResponse } from "../contracts/effect.js";
import { coreError } from "../contracts/error.js";
import { IN_PORT, SUCCESS_PORT } from "./reserved.js";

export const delaySpec: NodeSpec = {
  type: "core.delay",
  version: 1,
  configSchema: {
    type: "object",
    additionalProperties: false,
    properties: { durationMs: { type: "number", minimum: 0 } },
  },
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: { durationMs: { type: "number", minimum: 0 } },
  },
  outputSchema: {
    type: "object",
    required: ["elapsedMs"],
    additionalProperties: false,
    properties: { elapsedMs: { type: "number" } },
  },
  control: { inputs: [IN_PORT], outputs: [SUCCESS_PORT] },
};

const readDuration = (context: Parameters<NodeImplementation["start"]>[0]) => {
  const fromInput = context.inputs.durationMs;
  const fromConfig = context.config.durationMs;
  if (typeof fromInput === "number") {
    return fromInput;
  }
  if (typeof fromConfig === "number") {
    return fromConfig;
  }
  return undefined;
};

const completeDelay = (
  response: SettledEffectResponse,
  durationMs: number,
): ReturnType<NodeImplementation["start"]> => {
  if (response.status === "failed") {
    return { kind: "fail", error: response.error };
  }
  return {
    kind: "complete",
    outputs: { elapsedMs: durationMs },
    activate: [SUCCESS_PORT],
  };
};

export const delayImplementation: NodeImplementation = {
  start: (context) => {
    const durationMs = readDuration(context);
    if (typeof durationMs !== "number") {
      return {
        kind: "fail",
        error: coreError("INVALID_NODE_CONFIG", "delay durationMs is required"),
      };
    }
    return {
      kind: "wait",
      effect: { kind: "timer", dueAt: context.logicalTime + durationMs },
      continuation: { durationMs },
    };
  },
  resume: (_context, continuation, response) => {
    const durationMs =
      continuation !== null &&
      typeof continuation === "object" &&
      !Array.isArray(continuation) &&
      typeof continuation.durationMs === "number"
        ? continuation.durationMs
        : 0;
    return completeDelay(response, durationMs);
  },
};
