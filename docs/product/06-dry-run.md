# Dry-run과 운영 복구

시험은 runtime에서만 실행합니다. 브라우저는 fixture와 입력을 보내고, 결과는 공식 registry로 만든 같은 core 경로를 탑니다. `@howling/core`의 `createDryRunDriver`와 `startRun(..., { mode: "dryRun" })`을 host가 씁니다.

## 시험 세션

편집기의 **시험**은 현재 draft를 불변 test artifact로 고정한 뒤 `POST /flows/:flowId/test-sessions`를 보냅니다.

```json
{
  "source": "draft",
  "input": { "power": 1400 },
  "fixtures": [
    {
      "nodeId": "effect",
      "index": 0,
      "adapter": "homeassistant",
      "operation": "call_service",
      "response": { "source": "fixture", "status": "succeeded", "value": { "ok": true } }
    }
  ],
  "progression": "auto",
  "idempotencyKey": "test-1"
}
```

`source`는 `draft` | `revision` | `run`입니다. `run`은 기존 live 실행의 정규화 입력으로 **새** dry-run을 엽니다. live `mode`는 바꾸지 않습니다.

runtime이 꺼져 있으면 즉시 409 `runtime_offline`입니다. 202는 접수이고 `runId`가 같이 옵니다.

## 실행 화면

`/runs/:runId`는 `GET .../events` EventSource를 구독합니다. `Last-Event-ID` 또는 `?after=`로 cursor를 이어갑니다. 보관 밖 cursor는 409 `resync_required`입니다. SSE가 끊기면 JSON polling이 보조합니다.

제품 명령:

```bash
curl -sS -X POST \
  -H "content-type: application/json" \
  -H "x-csrf-token: ${CSRF}" \
  -H "cookie: ${COOKIE}" \
  --data '{ "type": "step", "commandId": "step-1" }' \
  "http://127.0.0.1:5173/api/v1/sites/${SITE_ID}/runs/${RUN_ID}/commands"
```

`type`은 `step` | `continue` | `pause` | `resume` | `cancel` | `fixture`입니다. 오프라인 queue에 쌓지 않습니다. 수동 command 만료는 30초입니다.

`continue`는 progression을 `auto`로 바꾸고 같은 coordinator가 이어서 갑니다. fixture는 effect schema를 검사한 뒤 core `effect.resolved` (`source: "fixture"`)로만 변환합니다.

## Dry-run 규칙

- HA adapter를 연결하지 않습니다. 호출 수는 0입니다.
- live `node_states`에 쓰지 않습니다. 결과는 `proposedState`와 test snapshot에만 남습니다.
- fixture가 없으면 `needs-input` / `waiting`입니다. 입력 후 step 또는 continue로 이어갑니다.
- 시작한 세션의 artifact는 고정입니다. 이후 draft 편집은 그 세션을 바꾸지 않습니다.
- 재시작 뒤 가상 시간과 fixture 순서를 복원합니다. manual이면 Continue 전에 자동 step이 없습니다.

## Summary journal

runtime은 `summary.batch`로 allowlist 요약만 올립니다 (`type`, `nodeId`, `sequence`, `status`). 센서 원본과 effect payload는 기본 cloud DB·SSE·로그에 넣지 않습니다.

Cloud는 `(runtimeId, stream, syncSeq)`로 중복을 제거하고 연속 `syncSeq`만 `summary.ack`합니다. 연결이 다시 열리면 runtime이 미ACK batch를 다시 보냅니다. 기존 `run.summary`는 호환 입력으로 남습니다.

## Rollback

`POST /flows/:flowId/deployments`에 `{ revisionId, rollback?: true, stateEpoch?: "reset"|"keep" }`를 보냅니다. 기본은 `reset`입니다.

- 이전 revision을 **새 generation**으로 활성화합니다. 과거 generation을 되살리지 않습니다.
- `reset`이면 `state_epoch`를 `epoch_N`으로 올립니다.
- `keep`은 **같은 revision의 기존 epoch**만 고를 수 있습니다. revision 사이 state migration은 없습니다.
- 이미 수락한 queue와 진행 중 run은 이전 epoch를 유지합니다. 신규 입력만 되돌린 revision으로 실행됩니다.

편집기 **되돌리기**는 직전 revision + 초기화입니다. Active ACK 전에는 완료로 표시하지 않습니다.

## 로컬 runtime HTTP

클라우드 없이 같은 루프를 치려면:

```bash
curl -sS -X POST http://127.0.0.1:4000/v1/runs \
  -H "content-type: application/json" \
  --data '{
    "artifactId": "power-alert",
    "input": { "power": 1400 },
    "mode": "auto",
    "runMode": "dryRun",
    "idempotencyKey": "local-dry",
    "initialState": { "mean": [800, 900, 1100, 1200] },
    "fixtures": [
      {
        "nodeId": "notify",
        "index": 0,
        "adapter": "test.notifications",
        "operation": "send",
        "response": { "source": "fixture", "status": "succeeded", "value": { "accepted": true } }
      }
    ]
  }'
```

다음: [E2E](./05-e2e.md)
