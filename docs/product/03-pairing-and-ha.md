# Pairing과 HA

제품 연결 경로는 pairing입니다. 사람 code만으로 credential을 가져올 수 없습니다. HA 토큰은 SQLite가 아니라 파일입니다.

## 누가 무엇을 보나

| 주체 | 하는 일 |
| --- | --- |
| Runtime | `POST /api/v1/runtime-pairings`로 `{ pairingId, code, runtimeSecret }`을 받는다 |
| 사람 | code를 `/connections`에 넣는다 |
| 브라우저 | 세션으로 `POST /api/v1/sites/:siteId/runtime/pair` `{ code }` |
| Runtime | `x-runtime-secret`으로 완료를 polling한 뒤 ACK. secret을 파일에 쓰고 WSS hello |
| ACK 또는 만료 | API가 issued token을 폐기한다 |

Pairing 전에는 배포·실행 command를 거절합니다.

## 로컬 setup 페이지

```text
http://127.0.0.1:4000/setup
```

이 페이지에서 HA URL·long-lived token을 저장하고 Pairing 시작을 누릅니다. 토큰은 `data/secrets/ha-token`에 mode `0600`으로 씁니다. HA OS 앱은 `SUPERVISOR_TOKEN`이 있으면 `http://supervisor/core`를 쓰고 URL을 다시 넣지 않습니다. 클라우드 Connections 화면은 metadata와 code 입력만 있습니다. secret 재조회 API는 없습니다.

## curl로 pairing

runtime과 api가 떠 있고, 브라우저 세션 쿠키가 있다고 가정합니다. 쿠키 파일은 로그인 콜백 뒤에 브라우저 개발자 도구에서 복사합니다.

Runtime이 pairing을 요청하는 것과 같은 호출:

```bash
curl -sS -X POST http://127.0.0.1:3000/api/v1/runtime-pairings
```

응답 예:

```json
{
  "pairingId": "11111111-1111-1111-1111-111111111111",
  "code": "a1b2c3",
  "runtimeSecret": "runtime-secret-not-for-humans",
  "expiresAt": "2026-09-14T12:00:00.000Z"
}
```

`runtimeSecret`은 사람 화면에 두지 않습니다. runtime만 `x-runtime-secret`으로 조회합니다.

```bash
PAIRING_ID='11111111-1111-1111-1111-111111111111'
RUNTIME_SECRET='runtime-secret-not-for-humans'

curl -sS \
  -H "x-runtime-secret: ${RUNTIME_SECRET}" \
  "http://127.0.0.1:3000/api/v1/runtime-pairings/${PAIRING_ID}"
```

claimed 전:

```json
{ "status": "pending" }
```

브라우저에서 code를 넣은 뒤 같은 GET은 token을 돌려줍니다. runtime은 ACK합니다.

```bash
curl -sS -X POST \
  -H "x-runtime-secret: ${RUNTIME_SECRET}" \
  "http://127.0.0.1:3000/api/v1/runtime-pairings/${PAIRING_ID}/ack"
```

로컬 runtime이 대신 해 주는 진입점:

```bash
curl -sS -X POST http://127.0.0.1:4000/v1/setup/pair
curl -sS http://127.0.0.1:4000/v1/setup/status
```

`status` 예:

```json
{
  "haConfigured": true,
  "pairing": {
    "status": "pending",
    "code": "a1b2c3",
    "pairingId": "11111111-1111-1111-1111-111111111111"
  }
}
```

웹 `/connections`의 Pairing code에 `a1b2c3`을 넣고 **연결**을 누릅니다. `runtime-online`이 `online`이면 pairing이 끝난 것입니다.

세션으로 code만 넣는 요청(브라우저가 하는 일):

```bash
SITE_ID=site_dev
CSRF='csrf-from-auth-me'
COOKIE='howling_session=...; howling_csrf=...'

curl -sS -X POST \
  -H "content-type: application/json" \
  -H "x-csrf-token: ${CSRF}" \
  -H "cookie: ${COOKIE}" \
  --data '{"code":"a1b2c3"}' \
  "http://127.0.0.1:5173/api/v1/sites/${SITE_ID}/runtime/pair"
```

code만으로 `GET /runtime-pairings/:id`를 호출해도 token이 나오지 않아야 합니다.

## HA 토큰 저장

Long-lived token은 HA 프로필에서 만듭니다. runtime에만 넣습니다.

```bash
curl -sS -X POST http://127.0.0.1:4000/v1/setup/ha \
  -H "content-type: application/json" \
  --data '{
    "url": "http://127.0.0.1:8123",
    "token": "HA_LONG_LIVED_TOKEN"
  }'
```

파일:

```text
data/secrets/ha-url
data/secrets/ha-token
```

`RUNTIME_SECRET_ROOT` 기본값은 `data`입니다. 경로는 `${secretRoot}/secrets/${name}`입니다.

토큰을 로그·스크린샷·git에 남기지 않습니다.

## HA 준비 상태

Runtime은 HA `/api/websocket`에 붙어 인증, `get_states`, `get_services`, `subscribe_events`(`state_changed`)를 합니다.

```text
configured → connecting → authenticating → synchronizing → ready | error
ready → disconnected → reconnecting
```

`ready`는 인증 + 초기 snapshot + 구독 ACK입니다. TCP만으로 ready를 표시하지 않습니다.

스냅샷, 재연결 스냅샷, `unknown`/`unavailable`에서 돌아온 첫 값은 live run을 만들지 않습니다. 숫자는 유한 숫자 문자열만 매핑합니다. 빈 값이나 `unknown`을 0으로 바꾸지 않습니다.

웹 Connections의 `ha-status`가 `ready`면 동기화가 끝난 것입니다.

## Adapter

`core.effect`의 adapter는 `homeassistant`, operation은 `call_service`입니다. coordinator는 `dispatchStarted`를 커밋한 뒤에만 호출합니다.

요청 예:

```json
{
  "domain": "input_boolean",
  "service": "turn_on",
  "service_data": { "entity_id": "input_boolean.test_alert" }
}
```

구독과 상태 이벤트는 WebSocket입니다. 서비스 호출은 REST `POST /api/services/{domain}/{service}`입니다. 성공은 서비스 응답입니다. entity `state_changed`는 별도 관측입니다.

`RUNTIME_TEST_HOOKS=1`이면 runtime이 `GET /v1/test/hooks`를 엽니다.

```bash
curl -sS http://127.0.0.1:4000/v1/test/hooks
```

```json
{ "haServiceCalls": 1, "requestIds": [4] }
```

E2E는 helper가 ON인 것만으로 1회를 단정하지 않고 이 hook을 봅니다.

다음: [편집기와 실행](./04-editor-and-runs.md)
