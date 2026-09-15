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
| list_flows, get_flow, get_run, get_run_summary | `read` |
| save_draft, validate_flow | `edit` |
| start_dry_run | `run` |
| create_revision, deploy_revision | `deploy` |
| start_live_run | `run` + 활성 배포 |
| get_run_detail | `data.read`. 중계만, 원본 ON을 켜지 않음 |

읽기 token으로 배포·live·원본 조회는 거부한다. `flowId`가 묶인 token은 그 플로 밖을 404로 본다. runtime offline이면 웹과 같은 `runtime_offline`이다.

원문 토큰은 `POST /api/v1/sites/:siteId/tokens` 응답에 한 번만 있다. 이후 목록은 hash·scope·revoked만 준다. Cloud DB·SSE·로그에 MCP 인자·응답 원문을 넣지 않는다.

## OAuth 중계

Runtime이 state·PKCE를 만들고 authorization URL을 준다. API callback은 code를 WSS `oauth.code`로 한 번 넘기고 저장하지 않는다. token 교환은 runtime이다. callback 때 runtime offline이면 성공으로 표시하지 않는다. 제공자 목록은 `/connections`와 runtime `/setup`에 있다.

## 검증

테스트 MCP는 echo·fail·count와 호출 횟수를 기록한다. Playwright `e2e/tests/mcp.spec.ts`는 echo 플로를 배포해 호출 1을 확인하고, 같은 플로 dry-run은 호출을 늘리지 않는다. 기존 전력 평균 live E2E `haServiceCalls === 1`은 그대로 통과해야 한다.
