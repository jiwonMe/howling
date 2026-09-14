/** 해석된 입력 필드를 하나의 JSON 객체로 묶는다. 자동 펼치기나 item 반복은 없다. */
import type { NodeImplementation, NodeSpec } from "../contracts/node.js";
import { IN_PORT, SUCCESS_PORT } from "./reserved.js";

export const mapSpec: NodeSpec = {
  type: "core.map",
  version: 1,
  configSchema: { type: "object", additionalProperties: false },
  inputSchema: { type: "object" },
  outputSchema: {
    type: "object",
    required: ["value"],
    additionalProperties: false,
    properties: { value: { type: "object" } },
  },
  control: { inputs: [IN_PORT], outputs: [SUCCESS_PORT] },
};

export const mapImplementation: NodeImplementation = {
  start: (context) => ({
    kind: "complete",
    outputs: { value: context.inputs },
    activate: [SUCCESS_PORT],
  }),
};
