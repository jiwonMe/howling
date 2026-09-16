# 편집기와 실행

편집기는 core 공식 catalog 여덟 노드를 캔버스에 올립니다. undo/redo와 그룹은 없습니다. 서버 초안과 캔버스 좌표는 따로 저장합니다. 좌표만 바꾸면 artifact digest가 바뀌지 않습니다. catalog version은 `2026.09.1`로 유지합니다.

## 화면 배치

- 왼쪽: 노드 팔레트(200px). 맨 위 검색 칸에 이름·설명·종류·type 아무 것이나 치면 목록이 좁혀지고, `Enter`는 첫 항목을 추가, `Escape`는 검색을 지웁니다. 항목은 아이콘·이름·종류 한 줄이고 한 줄 설명은 마우스를 올리면(title) 보입니다. 종류 순서는 시작·계산·분기·합류·시간·동작. 화면 이름 ↔ catalog type: 입력 `core.input`, 이동 평균 `analysis.rolling-mean`, 값 묶기 `core.map`, 조건 `core.condition`, 모두 기다림 `core.all`, 먼저 온 것 `core.any`, 대기 `core.delay`, 동작 `core.effect`. 표시 정보는 `apps/web/src/lib/node-meta.ts`에만 있고 catalog 계약은 그대로입니다
- 가운데: React Flow. 카드마다 아이콘·이름·id, 두 번째 줄에 설정 요약(`mean.mean > 1000`, `Test Alert · 켜기`, `1초 기다림`…)이 보이고, 빠진 설정은 빨간 글씨와 점선 테두리로 표시합니다. 일반 노드는 이전 노드와 자동으로 이어집니다. Condition은 오른쪽에 「참」「거짓」 두 포트, All/Any는 왼쪽에 이름 포트가 나오고 선에도 포트 이름이 붙습니다
- 삭제: 노드나 선을 누르고 `Delete`/`Backspace`, 또는 오른쪽 패널의 「이 노드 삭제」「이 연결 삭제」. 노드를 지우면 그 노드를 가리키던 binding과 선도 함께 지웁니다
- 오른쪽: 노드를 고르면 그 노드만. 캔버스를 비우거나 「플로 설정」을 누르면 시험 입력·자동 실행(기기 trigger). 「고급: HA entity」는 예전 `entity_id` 입력
- 위: 저장·검증 | Revision·배포·해제·되돌리기 | 시험·실행 | 원본 보관(`captureRaw`). 버튼마다 툴팁이 있습니다
- Effect adapter는 기본 `device` / `action`. `homeassistant`는 「고급 (HA 서비스)」, `mcp`면 로컬에서 발견한 connection·tool을 고른다
- Map은 필드 이름과 값 출처. Delay는 `durationMs`(ms). All/Any는 `inputNames`와 이름별 값. Condition은 「비교 방법」(`operator`)과 「비교값」(`right`)

## 노드

| 타입 | 하는 일 |
| --- | --- |
| `core.input` | 실행 입력을 `value`로 게시 |
| `analysis.rolling-mean` | 최근 N개 숫자 평균 |
| `core.condition` | `eq\|neq\|gt\|gte\|lt\|lte\|isTrue\|isFalse` 후 true/false |
| `core.effect` | 기기·MCP·HA adapter 호출 |
| `core.map` | 해석된 필드를 한 객체로 묶음 |
| `core.delay` | `durationMs` 동안 대기 |
| `core.all` | 이름 포트가 모두 와야 진행. 출력 `values` |
| `core.any` | 이름 포트 중 하나가 오면 진행. 출력 `source`, `value` |

## 전력 평균 플로를 만드는 예

1. `/flows`에서 **새 플로**를 누른다. 이름이 `Power alert`로 만들어진다.
2. 팔레트에서 Input → Rolling mean → Condition → Effect 순으로 추가한다.
3. Trigger에서 기기 `Test Power`를 고른다. 저장값은 `kind: "device.changed"`, `config.deviceId`, `inputKey: "power"`다. `entity_id`는 초안에 없다.
4. mean 노드: `windowSize` `5`, value path `/power`.
5. condition 노드: operator는 기본 `gt`, right `1000`. left는 mean의 `mean` 출력.
6. effect 노드: 기기 `Test Alert`, 동작 `turn_on`. adapter는 `device` / `action`. request는 `{ deviceId, action }`.

저장 뒤에 **검증**이 `검증 통과`여야 합니다. **배포**는 저장 → revision → desired.deployment를 한 번에 보냅니다. 헤더가 `배포 active`가 될 때까지 기다립니다. **해제**는 같은 generation 규칙으로 runtime 포인터를 끕니다. 헤더가 `배포 inactive`가 되면 상태 탭 활성 목록에서 빠집니다.

## API

모두 `/api/v1/sites/:siteId` 아래입니다. 쿠키 세션과 `x-csrf-token`이 필요합니다. 웹과 `POST /mcp`가 같은 application service를 부릅니다. scoped token은 `/connections`에서 발급합니다.

| 경로 | 동작 |
| --- | --- |
| `GET/POST /flows` | 목록·생성 |
| `GET /flows/:flowId` | 초안 + 배포 상태 |
| `DELETE /flows/:flowId` | 초안 삭제. 활성이면 해제 후 삭제 |
| `PUT .../draft`, `PUT .../editor` | 기대 `version`. 충돌이면 409 |
| `POST .../validate` | 공식 catalog + core compile |
| `POST .../revisions` | 불변 artifact + digest |
| `POST .../deployments` | generation++, desired 전송, HTTP 202 |
| `POST .../deactivate` | 활성 배포 해제. generation++, HTTP 202 |
| `GET /deployments/:id` | requested / validating / staged / active / failed / inactive |
| `GET /connections`, `GET /catalog` | runtime이 보고한 metadata |
| `GET /devices` | 이름·종류·동작. `entity_id` 없음 |
| `POST /flows/:id/runs` | 배포된 revision 수동 실행, idempotency key |
| `POST /flows/:id/test-sessions` | draft/revision/run을 고정해 dry-run. 202 + runId |
| `POST /runs/:id/commands` | step/continue/pause/fixture. 오프라인 409 |
| `GET /runs`, `GET /runs/:id` | 요약. 원본 payload 없음 |
| `GET /runs/:id/events` | summary SSE 또는 JSON cursor |
| `GET/PUT /data-policy`, `POST .../purge` | 원본 ON·보관. purge는 OFF와 별개 |
| `GET/PUT /observations` | 관측 필드 |
| `GET /analytics` | 공식 집계. payload 없음 |
| `POST /runs/:id/detail-requests` | `data.read`. 중계만, 원본 ON을 켜지 않음 |

로그인된 세션으로 목록을 보는 예:

```bash
SITE_ID=site_dev
COOKIE='howling_session=...'

curl -sS -H "cookie: ${COOKIE}" \
  "http://127.0.0.1:5173/api/v1/sites/${SITE_ID}/flows"

curl -sS -H "cookie: ${COOKIE}" \
  "http://127.0.0.1:5173/api/v1/sites/${SITE_ID}/runs"
```

초안 저장 몸통 예:

```json
{
  "expectedVersion": 1,
  "definition": {
    "schemaVersion": 1,
    "id": "FLOW_ID",
    "revision": "draft",
    "entryNodeId": "input",
    "nodes": [
      {
        "id": "input",
        "type": "core.input",
        "version": 1,
        "config": {},
        "inputs": {}
      },
      {
        "id": "mean",
        "type": "analysis.rolling-mean",
        "version": 1,
        "config": { "windowSize": 5 },
        "inputs": {
          "value": {
            "kind": "output",
            "nodeId": "input",
            "output": "value",
            "path": "/power"
          }
        }
      }
    ],
    "edges": [
      {
        "id": "e-input-mean",
        "source": { "nodeId": "input", "port": "success" },
        "target": { "nodeId": "mean", "port": "in" }
      }
    ]
  },
  "triggers": [
    {
      "id": "device-trigger",
      "kind": "device.changed",
      "connectionId": "ha",
      "config": { "deviceId": "dev_0123456789abcdef", "inputKey": "power" }
    }
  ],
  "connections": [{ "id": "ha", "kind": "ha", "connectionId": "ha" }]
}
```

`device.changed` 또는 HA trigger가 있으면 connections에 `kind: "ha"`가 있어야 배포가 됩니다. catalog version은 `2026.09.1`입니다. 기기는 [기기](./09-devices.md)입니다.

## Runtime이 받는 배포

WSS 이름(예약 그대로):

| 방향 | type |
| --- | --- |
| API → runtime | `desired.deployment`, `run.start`, `run.step`, `summary.ack`, `devices.create`, `devices.integrate` |
| runtime → API | `hello`, `heartbeat`, `activation.result`, `summary.batch`, `run.summary`, `connections.snapshot`, `devices.snapshot`, `devices.created`, `devices.integrated` |

Runtime은 digest·노드 버전·HA connection binding을 검사한 뒤 `revision_artifacts`를 upsert합니다. 활성 포인터는 한 SQLite 트랜잭션입니다. 실패하면 이전 활성 revision을 유지합니다.

같은 site에 새 pairing이 오면 API hub는 이전 소켓을 버리고 OPEN 소켓으로만 `desired.deployment`를 보냅니다.

## 실행 상세

`/runs/:runId`는 summary SSE를 구독합니다. 실패하면 5초 polling이 보조합니다. 자세한 시험·rollback은 [Dry-run](./06-dry-run.md)입니다.

화면에 남는 것:

- `runId`, revision, status, lastSeq
- trigger 입력 (원본 HA payload는 없음)
- 노드/edge 이벤트. 대기·오류·unknown
- HA 서비스 응답과 entity 관측은 다른 사건

단계 1에서 시드한 `power-alert` / `delay-effect` artifact는 HA trigger가 없습니다. 로컬 `POST /v1/runs`용입니다. 제품 완료 판정에 이 시드를 배포만 해서 통과시키지 않습니다.

## 배포 해제

활성 배포가 있을 때:

```bash
SITE_ID=site_dev
FLOW_ID='........-....-....-....-............'
CSRF='csrf-from-auth-me'
COOKIE='howling_session=...; howling_csrf=...'

curl -sS -X POST \
  -H "content-type: application/json" \
  -H "x-csrf-token: ${CSRF}" \
  -H "cookie: ${COOKIE}" \
  --data '{}' \
  "http://127.0.0.1:5173/api/v1/sites/${SITE_ID}/flows/${FLOW_ID}/deactivate"
```

응답 예:

```json
{
  "deploymentId": "........-....-....-....-............",
  "generation": 4
}
```

`202`는 접수입니다. `GET /deployments/:id`의 `status`가 `inactive`여야 꺼진 것입니다. 되돌리기(이전 revision 재배포)와 다릅니다.

MCP:

```json
{ "name": "deactivate_flow", "arguments": { "flowId": "FLOW_ID" } }
```

## 플로 삭제

`/flows` 목록의 **삭제**는 초안·revision·배포 행을 지웁니다. 실행 요약은 로그에 남습니다. 그 플로에 묶인 token은 회수합니다. 최신 배포가 `active`이면 runtime에 해제를 보낸 뒤 지웁니다. runtime이 꺼져 있으면 `409 runtime_offline`이고 초안은 그대로입니다.

```bash
SITE_ID=site_dev
FLOW_ID='........-....-....-....-............'
CSRF='csrf-from-auth-me'
COOKIE='howling_session=...; howling_csrf=...'

curl -sS -X DELETE \
  -H "x-csrf-token: ${CSRF}" \
  -H "cookie: ${COOKIE}" \
  "http://127.0.0.1:5173/api/v1/sites/${SITE_ID}/flows/${FLOW_ID}"
```

응답 예:

```json
{ "ok": true }
```

MCP:

```json
{ "name": "delete_flow", "arguments": { "flowId": "FLOW_ID" } }
```

## 로컬에서 run을 직접 시작

배포된 revision이 있고 runtime이 온라인일 때:

```bash
SITE_ID=site_dev
FLOW_ID='........-....-....-....-............'
CSRF='csrf-from-auth-me'
COOKIE='howling_session=...; howling_csrf=...'

curl -sS -X POST \
  -H "content-type: application/json" \
  -H "x-csrf-token: ${CSRF}" \
  -H "cookie: ${COOKIE}" \
  --data '{
    "input": { "power": 1400 },
    "mode": "auto",
    "idempotencyKey": "manual-1400"
  }' \
  "http://127.0.0.1:5173/api/v1/sites/${SITE_ID}/flows/${FLOW_ID}/runs"
```

202 뒤 `/logs`의 실행 목록 또는 `GET /runs`로 `runId`를 받아 `/runs/:runId`를 엽니다.

다음: [E2E](./05-e2e.md)
