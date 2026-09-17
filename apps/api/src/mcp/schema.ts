/**
 * describe_flow_schema: 플로 초안을 쓰는 데 필요한 계약을 한 번에 돌려준다.
 * 노드 스펙은 core registry에서 그대로 읽고, 트리거·effect·바인딩은 여기서 설명한다.
 */
import { NODE_CATALOG_VERSION, officialCatalog, sunsetDeskLightExample } from "@howling/contracts";
import { createOfficialRegistry } from "@howling/core";
import { denied, type Actor, type ServiceResult } from "../flows/access.js";

const nodes = createOfficialRegistry()
  .list()
  .map(({ spec }) => ({
    type: spec.type,
    version: spec.version,
    title: officialCatalog.find((item) => item.type === spec.type)?.title ?? spec.type,
    description: officialCatalog.find((item) => item.type === spec.type)?.description ?? "",
    configSchema: spec.configSchema,
    inputSchema: spec.inputSchema,
    outputSchema: spec.outputSchema,
    control: spec.control,
  }));

const definitionShape = {
  description:
    "definition은 { schemaVersion: 1, id: <flowId>, revision: string, entryNodeId, nodes[], edges[] }. " +
    "nodes[]는 { id, type, version, config, inputs }. edges[]는 제어 흐름만 나타내며 " +
    "{ id, source: { nodeId, port }, target: { nodeId, port } }. 값은 inputs 바인딩으로 흐른다. " +
    "일반 노드는 들어오는 제어 엣지가 정확히 하나여야 하고, 여러 경로가 만나면 core.any 또는 core.all을 쓴다.",
  ports: {
    regular: "입력 포트 in, 출력 포트 success. core.condition은 true/false. 실패 경로는 error 포트.",
    join: "core.any/core.all은 config.inputNames마다 같은 이름의 입력 포트와 inputs 값 바인딩이 필요하다.",
  },
  bindings: [
    { kind: "literal", shape: { kind: "literal", value: "<json>" }, note: "고정 값." },
    {
      kind: "input",
      shape: { kind: "input", path: "/trigger/offsetMinutes", default: 0 },
      note: "이번 실행 input. path는 JSON Pointer. 없을 때 default를 쓴다.",
    },
    {
      kind: "output",
      shape: { kind: "output", nodeId: "readSwitch", output: "result", path: "/state" },
      note: "다른 노드의 출력. 제어 엣지로 먼저 도달할 수 있어야 한다.",
    },
  ],
};

const effects = {
  description: "core.effect의 config.adapter/operation과 inputs.request 형태.",
  adapters: [
    {
      adapter: "device",
      operation: "action",
      request: { deviceId: "<deviceId>", action: "turn_on", data: { brightness_pct: 60 } },
      result: { ok: true },
      note: "list_devices의 actions 중 하나. data는 선택. entity_id는 받지 않는다.",
    },
    {
      adapter: "device",
      operation: "read",
      request: { deviceId: "<deviceId>" },
      result: {
        id: "<deviceId>",
        name: "작업실 스위치",
        kind: "switch",
        available: true,
        state: "off",
        value: null,
        on: false,
        attrs: {},
      },
      note: "현재 상태를 읽는다. state는 문자열, value는 숫자 state일 때 number, on은 on/off류일 때 boolean.",
    },
    {
      adapter: "mcp",
      operation: "call_tool",
      request: { connectionId: "<mcp connectionId>", tool: "<tool>", arguments: {} },
      note: "런타임에 등록한 외부 MCP 서버 도구 호출.",
    },
  ],
};

const triggers = {
  description:
    "triggers[]는 { id, kind, connectionId, config }. 실행 input은 { trigger: {...} } 또는 기기 값 객체.",
  kinds: [
    {
      kind: "sun",
      needsConnection: "ha",
      configSchema: {
        type: "object",
        required: ["event"],
        properties: {
          event: { type: "string", enum: ["sunset", "sunrise"] },
          offsetMinutes: { type: "integer", minimum: -720, maximum: 720, default: 0 },
        },
      },
      runInput: { trigger: { kind: "sun", event: "sunset", offsetMinutes: -30, eventAt: "<iso>", at: "<iso>" } },
      note: "HA sun.sun의 next_setting/next_rising 기준. offsetMinutes가 음수면 그만큼 먼저.",
    },
    {
      kind: "schedule",
      needsConnection: null,
      configSchema: {
        type: "object",
        required: ["time"],
        properties: {
          time: { type: "string", pattern: "^([01]\\d|2[0-3]):[0-5]\\d$" },
          days: { type: "array", items: { type: "integer", minimum: 0, maximum: 6 } },
        },
      },
      runInput: { trigger: { kind: "schedule", time: "07:30", at: "<iso>" } },
      note: "런타임 로컬 시간. days는 0(일)~6(토), 비우면 매일.",
    },
    {
      kind: "device.changed",
      needsConnection: "ha",
      configSchema: {
        type: "object",
        required: ["deviceId", "inputKey"],
        properties: { deviceId: { type: "string" }, inputKey: { type: "string" } },
      },
      runInput: { "<inputKey>": "<number | boolean>" },
      note: "숫자·binary 기기 값이 바뀔 때. inputKey 이름으로 새 값이 input에 들어간다.",
    },
    {
      kind: "ha.state_changed",
      needsConnection: "ha",
      configSchema: {
        type: "object",
        required: ["entityId"],
        properties: { entityId: { type: "string" }, inputKey: { type: "string" } },
      },
      runInput: { "<inputKey>": "<number>" },
      note: "고급: HA entity 숫자 상태 변경.",
    },
  ],
  connections: [{ id: "ha", kind: "ha", connectionId: "ha" }],
};

export const describeFlowSchema = (): Record<string, unknown> => ({
  nodeCatalogVersion: NODE_CATALOG_VERSION,
  definition: definitionShape,
  nodes,
  effects,
  triggers,
  executionPolicy: { mode: "live | dry-run", captureRaw: false },
  example: sunsetDeskLightExample,
});

export const describeFlowSchemaFor = (actor: Actor): ServiceResult => {
  const scope = denied(actor, "read");
  if (scope) {
    return scope;
  }
  return { ok: true, status: 200, body: describeFlowSchema() };
};
