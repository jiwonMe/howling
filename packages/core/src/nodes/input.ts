/** 실행 입력 전체를 value로 게시하는 entry 노드. */
import type { NodeImplementation, NodeSpec } from "../contracts/node.js";
import { SUCCESS_PORT } from "./reserved.js";

export const inputSpec: NodeSpec = {
  type: "core.input",
  version: 1,
  configSchema: { type: "object", additionalProperties: false },
  inputSchema: { type: "object", additionalProperties: false },
  outputSchema: {
    type: "object",
    required: ["value"],
    additionalProperties: false,
    properties: { value: {} },
  },
  control: { inputs: [], outputs: [SUCCESS_PORT] },
};

export const inputImplementation: NodeImplementation = {
  start: (context) => ({
    kind: "complete",
    outputs: { value: context.runInput },
    activate: [SUCCESS_PORT],
  }),
};
