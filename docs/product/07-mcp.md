# MCP

단계 4는 두 방향을 같은 권한·revision·trace로 연다.

1. Runtime이 외부 MCP tools를 `core.effect` `adapter: "mcp"` `operation: "call_tool"`로 호출한다.
2. API `POST /mcp`가 웹과 같은 application service로 플로·시험·배포·실행을 연다.

`@howling/core`는 바꾸지 않는다. session·transport wire는 definition에 없다.

## Runtime client

로컬 setup `http://127.0.0.1:4000/setup`에서만 MCP를 등록한다.

| 항목 | 위치 |
| --- | --- |
| id·name·status·digest | runtime SQLite `connection_configs` |
| transport·url·command | `{secretRoot}/secrets/mcp-{id}-config` |
| bearer token | `{secretRoot}/secrets/mcp-{id}-token` |

Cloud API는 stdio command를 받지 않는다. stdio는 runtime 로컬 setup에만 있다. Dry-run은 live MCP adapter를 호출하지 않는다.

Effect 입력:

```json
{ "connectionId": "echo", "tool": "echo", "arguments": { "text": "ping" } }
```

미준비·타임아웃·schema digest 불일치는 `{ status: "unknown" }`이다. 호출은 `effect.dispatchStarted` persist 뒤에만 한다.

## 플랫폼 `/mcp`

`Authorization: Bearer`만 쓴다. 쿠키·CSRF는 없다.

| Tool | Scope |
| --- | --- |
| describe_flow_schema, list_flows, get_flow, list_runs, get_run, get_run_summary, list_devices | `read` |
| create_flow, rename_flow, save_draft, validate_flow, delete_flow, create_device, update_device, delete_device | `edit` |
| start_dry_run, act_device | `run` |
| create_revision, deploy_revision, deactivate_flow | `deploy` |
| start_live_run | `run` + 활성 배포 |
| get_run_detail | `data.read`. 중계만, 원본 ON을 켜지 않음 |

`act_device`는 플로 없이 기기를 바로 조작한다. 웹 대시보드와 같은 WSS `devices.action` → `devices.acted` 경로를 타고, 응답은 바뀐 기기 summary만이다. `list_devices`가 준 `actions` 밖의 동작은 runtime이 거절한다.

```json
{ "name": "act_device", "arguments": { "deviceId": "dev_light", "action": "turn_on", "data": { "brightness_pct": 70 } } }
```

`create_device`는 시험용 가상 기기를 만든다. `kind` 또는 `product` 또는 `fields` 중 하나만 준다. 여러 값 한 대는 `fields`다. `key: state` 필드는 `device.read`의 `/state`가 된다.

```json
{
  "name": "create_device",
  "arguments": {
    "name": "작업실 환경",
    "fields": [
      { "key": "occupied", "type": "boolean", "label": "재실" },
      { "key": "state", "type": "select", "options": ["sunny", "cloudy", "rainy"] },
      { "key": "temperature", "type": "number", "label": "온도" }
    ]
  }
}
```

값을 바꿀 때는 `act_device` `{ deviceId, action: "set_fields", data: { occupied: true, state: "cloudy", temperature: 18 } }`.

`tools/list`는 각 tool의 설명과 JSON Schema `inputSchema`를 준다(`apps/api/src/mcp/catalog.ts`). 인자 검증은 dispatch의 zod가 하고, 실패하면 JSON-RPC `error.message`에 필드 요약, `error.data.error.issues[]`에 `{ path, message, code }`를 싣는다. 트리거는 `save_draft`·`create_flow`·`create_revision`에서 kind별 config를 검사한다(`triggerListSchema`).

### 플로 작성 순서

```
describe_flow_schema           노드·포트·바인딩·effect·트리거 계약과 완성 예시
list_devices                   deviceId와 actions
create_flow({ name, definition?, triggers?, connections? })   빈 초안 또는 초안까지 한 번에
rename_flow / save_draft       이름은 rename_flow, 내용은 save_draft(expectedVersion = draft.version)
validate_flow                  컴파일만
start_dry_run                  fixtures로 effect 응답을 흉내내 분기 확인
create_revision → deploy_revision
list_runs / get_run            실행 추적. start_live_run은 { accepted: true }만 돌려준다
```

`describe_flow_schema`의 예시는 「일몰 작업실 조명」이다(`@howling/contracts` `sunsetDeskLightExample`). api 테스트가 컴파일을, runtime 테스트가 dry-run 분기를 확인한다.

### 시간 트리거

| kind | config | HA 필요 | 실행 input |
| --- | --- | --- | --- |
| `sun` | `{ event: "sunset" \| "sunrise", offsetMinutes?: -720..720 }` | 예 (`sun.sun` next_setting/next_rising) | `{ trigger: { kind, event, offsetMinutes, eventAt, at } }` |
| `schedule` | `{ time: "HH:mm", days?: [0..6] }` | 아니오 | `{ trigger: { kind, time, days?, at } }` |

Runtime `triggers/time.ts`가 20초마다 활성 revision을 돌며 due가 된 트리거를 inbox에 넣는다. due는 미래일 때 한 번 기억하므로 HA의 `next_setting`이 다음 날로 넘어가도 오늘 것을 잊지 않는다. due 뒤 5분(grace) 안이면 재시작 후에도 실행하고, idempotencyKey는 `artifactId:triggerId:dueISO`다.

### 상태 읽기와 집합 비교

`core.effect` `adapter: "device"` `operation: "read"` `request: { deviceId }`는 HA 호출 없이 runtime SQLite의 현재 상태를 돌려준다.

```json
{ "id": "dev_…", "name": "작업실 스위치", "kind": "switch", "available": true, "state": "off", "value": null, "on": false, "attrs": {} }
```

`state`는 문자열, `value`는 숫자 state일 때 number, `on`은 on/off류일 때 boolean이다. `core.condition`은 `in` / `notIn`을 받는다. `right`는 배열이어야 하며 원소 비교는 `eq`와 같은 구조 동등이다. 예: weather `state`가 `["cloudy","rainy","fog"]` 안인지.

읽기 token으로 배포·live·원본 조회는 거부한다. `flowId`가 묶인 token은 그 플로 밖을 404로 본다. runtime offline이면 웹과 같은 `runtime_offline`이다.

원문 토큰은 `POST /api/v1/sites/:siteId/tokens` 응답에 한 번만 있다. 이후 목록은 hash·scope·revoked만 준다. Cloud DB·SSE·로그에 MCP 인자·응답 원문을 넣지 않는다.

## OAuth 중계

Runtime이 state·PKCE를 만들고 authorization URL을 준다. API callback은 code를 WSS `oauth.code`로 한 번 넘기고 저장하지 않는다. token 교환은 runtime이다. callback 때 runtime offline이면 성공으로 표시하지 않는다. 제공자 목록은 `/connections`와 runtime `/setup`에 있다.

## 검증

테스트 MCP는 echo·fail·count와 호출 횟수를 기록한다. Playwright `e2e/tests/mcp.spec.ts`는 echo 플로를 배포해 호출 1을 확인하고, 같은 플로 dry-run은 호출을 늘리지 않는다. 기존 전력 평균 live E2E `haServiceCalls === 1`은 그대로 통과해야 한다.
