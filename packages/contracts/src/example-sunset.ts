/**
 * MCP describe_flow_schema가 돌려주는 본보기. 「일몰 작업실 조명」:
 * 맑음이면 일몰에, 흐림·비·눈·안개면 일몰 30분 전에 스위치를 켠다. 이미 켜져 있으면 건너뛴다.
 * api 테스트가 컴파일을, runtime 테스트가 dry-run 동작을 확인한다. core 계약이 바뀌면 함께 고친다.
 */

export const SWITCH_PLACEHOLDER = "<switch deviceId from list_devices>";
export const WEATHER_PLACEHOLDER = "<weather deviceId from list_devices>";

/** HA weather 상태 중 「어두운 날」. partlycloudy는 넣지 않는다. */
export const DARK_WEATHER = [
  "cloudy",
  "rainy",
  "pouring",
  "snowy",
  "snowy-rainy",
  "fog",
  "hail",
  "lightning",
  "lightning-rainy",
];

const readEffect = (id: string, deviceId: string) => ({
  id,
  type: "core.effect",
  version: 1,
  config: { adapter: "device", operation: "read" },
  inputs: { request: { kind: "literal", value: { deviceId } } },
});

const edge = (id: string, from: [string, string], to: [string, string]) => ({
  id,
  source: { nodeId: from[0], port: from[1] },
  target: { nodeId: to[0], port: to[1] },
});

export const sunsetDeskLightDefinition = (flowId: string) => ({
  schemaVersion: 1,
  id: flowId,
  revision: "draft",
  entryNodeId: "input",
  nodes: [
    { id: "input", type: "core.input", version: 1, config: {}, inputs: {} },
    readEffect("readSwitch", SWITCH_PLACEHOLDER),
    {
      id: "switchOff",
      type: "core.condition",
      version: 1,
      config: { operator: "eq" },
      inputs: {
        left: { kind: "output", nodeId: "readSwitch", output: "result", path: "/state" },
        right: { kind: "literal", value: "off" },
      },
    },
    readEffect("readWeather", WEATHER_PLACEHOLDER),
    {
      id: "isEarly",
      type: "core.condition",
      version: 1,
      config: { operator: "eq" },
      inputs: {
        left: { kind: "input", path: "/trigger/offsetMinutes", default: 0 },
        right: { kind: "literal", value: -30 },
      },
    },
    {
      id: "darkSky",
      type: "core.condition",
      version: 1,
      config: { operator: "in" },
      inputs: {
        left: { kind: "output", nodeId: "readWeather", output: "result", path: "/state" },
        right: { kind: "literal", value: DARK_WEATHER },
      },
    },
    {
      id: "either",
      type: "core.any",
      version: 1,
      config: { inputNames: ["atSunset", "earlyDark"] },
      inputs: {
        atSunset: { kind: "literal", value: "sunset" },
        earlyDark: { kind: "literal", value: "early" },
      },
    },
    {
      id: "turnOn",
      type: "core.effect",
      version: 1,
      config: { adapter: "device", operation: "action" },
      inputs: {
        request: { kind: "literal", value: { deviceId: SWITCH_PLACEHOLDER, action: "turn_on" } },
      },
    },
  ],
  edges: [
    edge("e1", ["input", "success"], ["readSwitch", "in"]),
    edge("e2", ["readSwitch", "success"], ["switchOff", "in"]),
    edge("e3", ["switchOff", "true"], ["readWeather", "in"]),
    edge("e4", ["readWeather", "success"], ["isEarly", "in"]),
    edge("e5", ["isEarly", "false"], ["either", "atSunset"]),
    edge("e6", ["isEarly", "true"], ["darkSky", "in"]),
    edge("e7", ["darkSky", "true"], ["either", "earlyDark"]),
    edge("e8", ["either", "success"], ["turnOn", "in"]),
  ],
});

export const sunsetDeskLightTriggers = [
  { id: "sunset", kind: "sun", connectionId: "ha", config: { event: "sunset", offsetMinutes: 0 } },
  {
    id: "sunset-early",
    kind: "sun",
    connectionId: "ha",
    config: { event: "sunset", offsetMinutes: -30 },
  },
];

export const sunsetDeskLightConnections = [{ id: "ha", kind: "ha", connectionId: "ha" }];

export const sunsetDeskLightExample = {
  title: "일몰 작업실 조명 (Sunset desk light)",
  steps: [
    "list_devices로 스위치와 weather 기기의 deviceId를 찾는다.",
    "create_flow({ name, definition, triggers, connections })로 초안까지 한 번에 만든다.",
    "validate_flow({ definition })로 컴파일을 확인한다.",
    "create_revision({ flowId }) → deploy_revision({ flowId, revisionId }).",
    "즉시 확인은 act_device({ deviceId, action: \"turn_on\" }) 또는 start_live_run.",
  ],
  definition: sunsetDeskLightDefinition("<flowId>"),
  triggers: sunsetDeskLightTriggers,
  connections: sunsetDeskLightConnections,
};
