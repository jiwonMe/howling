/**
 * tools/list에 내는 설명과 inputSchema. 인자 검증은 dispatch의 zod가 한다.
 */
import { MCP_TOOL_SCOPES } from "@howling/contracts";

type JsonSchema = Record<string, unknown>;

type ToolDoc = {
  readonly description: string;
  readonly inputSchema: JsonSchema;
};

const str = (description: string): JsonSchema => ({ type: "string", description });

const obj = (
  properties: Record<string, JsonSchema>,
  required: readonly string[] = [],
  description?: string,
): JsonSchema => ({
  type: "object",
  properties,
  ...(required.length > 0 ? { required } : {}),
  ...(description ? { description } : {}),
});

const flowId = str("플로 id");
const runId = str("run id");

const actionData = {
  type: "object",
  description:
    "동작에 붙는 값. 예: set_value → { value: 50 }, set_temperature → { temperature: 24 }, " +
    "volume_set → { volume_level: 0.3 }, set_cover_position → { position: 40 }, " +
    "turn_on(조명) → { brightness_pct: 70 }. entity_id는 넣을 수 없다.",
  additionalProperties: { type: ["string", "number", "boolean"] },
} satisfies JsonSchema;

const triggersSchema = {
  type: "array",
  items: { type: "object" },
  description:
    "트리거 목록 [{ id, kind, connectionId, config }]. kind: sun { event: 'sunset'|'sunrise', offsetMinutes }, " +
    "schedule { time: 'HH:mm', days? }, device.changed { deviceId, inputKey }, ha.state_changed { entityId }. " +
    "sun·device.changed·ha.state_changed는 connectionId 'ha'와 connections의 ha 항목이 필요하다. " +
    "정확한 스키마와 예시는 describe_flow_schema.",
} satisfies JsonSchema;

const connectionsSchema = {
  type: "array",
  items: { type: "object" },
  description: "연결 목록. HA를 쓰면 [{ id: 'ha', kind: 'ha', connectionId: 'ha' }].",
} satisfies JsonSchema;

const definitionSchema = {
  type: "object",
  description:
    "플로 definition { schemaVersion: 1, id, revision, entryNodeId, nodes: [...], edges: [...] }. " +
    "노드 종류·포트·바인딩·effect 요청 형태는 describe_flow_schema가 준다.",
} satisfies JsonSchema;

const TOOL_DOCS: Readonly<Record<keyof typeof MCP_TOOL_SCOPES, ToolDoc>> = {
  describe_flow_schema: {
    description:
      "플로 초안을 쓰기 전에 먼저 호출한다. 노드 종류별 config/input/output JSON Schema와 포트, " +
      "바인딩 형태, core.effect의 device action/read 요청 형태, 트리거 kind별 config, " +
      "그리고 「일몰 작업실 조명」 완성 예시(definition·triggers·connections)를 돌려준다.",
    inputSchema: obj({}),
  },
  list_devices: {
    description:
      "이 집의 기기 목록. 각 기기의 id·name·kind·현재 state·reading·available과 " +
      "쓸 수 있는 actions를 준다. 기기를 조작하기 전에 먼저 호출해 id와 actions를 확인한다.",
    inputSchema: obj({}),
  },
  act_device: {
    description:
      "기기를 바로 조작한다(플로 없이). list_devices의 actions 중 하나를 action에 넣는다. " +
      "예: 조명 끄기 { deviceId, action: 'turn_off' }, 값 설정 { deviceId, action: 'set_value', data: { value: 800 } }. " +
      "응답은 바뀐 기기 summary. runtime이 꺼져 있으면 runtime_offline.",
    inputSchema: obj(
      {
        deviceId: str("list_devices에서 받은 기기 id"),
        action: str("기기의 actions 중 하나. 예: turn_on, turn_off, toggle, set_value, open, close"),
        data: actionData,
      },
      ["deviceId", "action"],
    ),
  },
  create_device: {
    description:
      "기기를 추가한다. 시험용 가상 기기는 kind만(number 또는 boolean 등), 집 기기는 product만 준다.",
    inputSchema: obj(
      {
        name: str("기기 이름"),
        kind: str("가상 기기 종류. number, boolean, light, switch 등. product와 같이 쓰지 않는다."),
        product: str("집 기기 제품군 이름. kind와 같이 쓰지 않는다."),
        min: { type: "number", description: "number 기기 최소값" },
        max: { type: "number", description: "number 기기 최대값" },
        step: { type: "number", description: "number 기기 단위" },
      },
      ["name"],
    ),
  },
  update_device: {
    description: "기기 이름을 바꾼다.",
    inputSchema: obj({ deviceId: str("기기 id"), name: str("새 이름") }, ["deviceId", "name"]),
  },
  delete_device: {
    description: "기기를 지운다. 삭제 가능한(deletable) 기기만.",
    inputSchema: obj({ deviceId: str("기기 id") }, ["deviceId"]),
  },
  list_flows: {
    description: "이 집의 플로 목록.",
    inputSchema: obj({}),
  },
  get_flow: {
    description: "플로 하나의 초안·리비전·배포 상태.",
    inputSchema: obj({ flowId }, ["flowId"]),
  },
  create_flow: {
    description:
      "새 플로를 만든다. name만 주면 빈 초안(version 1)이 생기고, definition·triggers·connections를 함께 주면 " +
      "그 초안이 바로 저장된다(version 2). definition.id는 서버가 새 플로 id로 채운다. " +
      "응답은 get_flow와 같은 상세. 이후 create_revision → deploy_revision으로 배포한다.",
    inputSchema: obj(
      {
        name: str("플로 이름 (1~80자)"),
        definition: definitionSchema,
        triggers: triggersSchema,
        connections: connectionsSchema,
      },
      ["name"],
    ),
  },
  rename_flow: {
    description: "플로 이름을 바꾼다. 초안 내용과 version은 그대로다. 응답은 get_flow와 같은 상세.",
    inputSchema: obj({ flowId, name: str("새 이름 (1~80자)") }, ["flowId", "name"]),
  },
  save_draft: {
    description:
      "플로 초안을 저장한다(자동 배포 아님). expectedVersion은 get_flow의 draft.version이어야 하며 " +
      "저장 후 version이 1 오른다. 이름은 바꾸지 않는다(rename_flow 사용). " +
      "잘못된 필드는 error.issues[].path로 알려준다.",
    inputSchema: obj(
      {
        flowId,
        draft: obj(
          {
            expectedVersion: { type: "integer", description: "현재 초안 버전 (get_flow의 draft.version)" },
            definition: definitionSchema,
            triggers: triggersSchema,
            connections: connectionsSchema,
            executionPolicy: obj({
              mode: { type: "string", enum: ["live", "dry-run"] },
              captureRaw: { type: "boolean" },
            }),
          },
          ["expectedVersion", "definition", "triggers", "connections"],
        ),
      },
      ["flowId", "draft"],
    ),
  },
  validate_flow: {
    description: "플로 definition을 저장 없이 검증한다.",
    inputSchema: obj({ definition: { type: "object" } }, ["definition"]),
  },
  start_dry_run: {
    description:
      "플로를 dry-run으로 시험한다. 실제 기기는 움직이지 않고 effect는 fixtures로 대신 답한다. " +
      "최소 인자: { flowId, source: 'draft', input: {}, idempotencyKey }. " +
      "응답 { runId, testSessionId } → get_run / get_run_summary로 노드별 결과를 본다.",
    inputSchema: obj(
      {
        flowId,
        source: { type: "string", enum: ["draft", "revision", "run"], description: "draft가 기본 선택" },
        revisionId: str("source가 revision일 때"),
        runId: str("source가 run일 때"),
        input: { description: "플로 입력. 예: { trigger: { kind: 'sun', offsetMinutes: -30 } }" },
        fixtures: {
          type: "array",
          description:
            "effect 노드의 가짜 응답. [{ nodeId, index: 0, response: { source: 'fixture', status: 'succeeded', value: {...} } }]. " +
            "빠진 effect 노드는 기본 { ok: true } 성공 응답으로 채운다. device read 노드에는 " +
            "value: { state: 'off', on: false }처럼 조건이 읽을 값을 넣어 준다.",
          items: obj(
            {
              nodeId: str("effect 노드 id"),
              index: { type: "integer", description: "그 노드의 몇 번째 effect인지. 보통 0" },
              response: obj(
                {
                  source: { type: "string", enum: ["fixture", "simulated"] },
                  status: { type: "string", enum: ["succeeded", "failed", "unknown"] },
                  value: { description: "effect 결과 값. device read면 { state: 'off', ... }" },
                },
                ["source", "status"],
              ),
            },
            ["nodeId", "index", "response"],
          ),
        },
        progression: { type: "string", enum: ["auto", "manual"], description: "기본 auto" },
        idempotencyKey: str("같은 요청을 구분하는 키 (예: 임의 UUID)"),
      },
      ["flowId", "source", "input", "idempotencyKey"],
    ),
  },
  create_revision: {
    description: "현재 초안을 리비전으로 고정한다.",
    inputSchema: obj({ flowId }, ["flowId"]),
  },
  deploy_revision: {
    description: "리비전을 runtime에 배포해 활성화한다.",
    inputSchema: obj(
      {
        flowId,
        revisionId: str("create_revision이 준 id"),
        rollback: { type: "boolean" },
        stateEpoch: { type: "string", enum: ["reset", "keep"] },
      },
      ["flowId", "revisionId"],
    ),
  },
  deactivate_flow: {
    description: "활성 배포를 내린다.",
    inputSchema: obj({ flowId }, ["flowId"]),
  },
  delete_flow: {
    description: "플로를 지운다.",
    inputSchema: obj({ flowId }, ["flowId"]),
  },
  start_live_run: {
    description:
      "활성 배포된 플로를 실제로 한 번 실행한다. 응답은 { accepted: true }이며 run id는 runtime이 정하므로 " +
      "잠시 뒤 list_runs({ flowId })에서 가장 최근 run을 찾아 get_run으로 추적한다.",
    inputSchema: obj(
      {
        flowId,
        input: { description: "플로 입력. 트리거 흉내: { trigger: { kind: 'sun', offsetMinutes: -30 } }" },
        mode: { type: "string", enum: ["auto", "manual"] },
        idempotencyKey: str("같은 요청을 구분하는 키 (예: 임의 UUID)"),
      },
      ["flowId", "idempotencyKey"],
    ),
  },
  list_runs: {
    description: "최근 run 목록(최신순). flowId를 주면 그 플로만.",
    inputSchema: obj({
      flowId: str("플로 id (선택)"),
      limit: { type: "integer", minimum: 1, maximum: 100, description: "기본 20" },
    }),
  },
  get_run: {
    description: "run 하나의 상태.",
    inputSchema: obj({ runId }, ["runId"]),
  },
  get_run_summary: {
    description: "run의 이벤트 요약. after 이후 sequence만 준다.",
    inputSchema: obj({ runId, after: { type: "integer", description: "마지막으로 본 sequence" } }, [
      "runId",
    ]),
  },
  get_run_detail: {
    description: "run의 원본 값 조회를 runtime에 중계한다. data.read scope.",
    inputSchema: obj(
      {
        runId,
        nodeId: str("노드 id"),
        field: str("필드 이름"),
        sequence: { type: "integer" },
      },
      ["runId"],
    ),
  },
};

export const listMcpTools = (): readonly {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: JsonSchema;
}[] =>
  (Object.keys(MCP_TOOL_SCOPES) as (keyof typeof MCP_TOOL_SCOPES)[]).map((name) => ({
    name,
    description: `${TOOL_DOCS[name].description} (scope: ${MCP_TOOL_SCOPES[name].join(", ")})`,
    inputSchema: TOOL_DOCS[name].inputSchema,
  }));
