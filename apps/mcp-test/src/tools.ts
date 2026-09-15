/**
 * 고정 echo·fail·count. 호출 횟수를 기록한다.
 */
export type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

export const createToolState = () => {
  let calls = 0;
  let lastTool = "";
  return {
    snapshot: () => ({ mcpCalls: calls, lastTool }),
    reset: () => {
      calls = 0;
      lastTool = "";
    },
    invoke: (name: string, args: Record<string, unknown>): ToolResult => {
      calls += 1;
      lastTool = name;
      if (name === "fail") {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: "forced" }) }],
          isError: true,
        };
      }
      if (name === "count") {
        return { content: [{ type: "text", text: JSON.stringify({ count: calls }) }] };
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ echoed: true, text: String(args.text ?? "") }),
          },
        ],
      };
    },
  };
};

export const toolList = [
  {
    name: "echo",
    description: "Echo text",
    inputSchema: {
      type: "object",
      properties: { text: { type: "string" } },
      required: ["text"],
    },
  },
  {
    name: "fail",
    description: "Always errors",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "count",
    description: "Return call count",
    inputSchema: { type: "object", properties: {} },
  },
];
