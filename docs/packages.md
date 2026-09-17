# 패키지 지도

Howling은 pnpm 워크스페이스입니다. Core는 독립 실행 엔진이고, 제품 앱은 같은 저장소에서 개발합니다.

## 패키지와 앱

| 이름 | 경로 | 역할 |
| --- | --- | --- |
| `howling` (private root) | `/` | 워크스페이스 스크립트. 앱이 아니다. |
| `@howling/core` | [`packages/core`](../packages/core) | 플로 compile, 단계 실행, effect intent, dry-run |
| `@howling/contracts` | [`packages/contracts`](../packages/contracts) | REST DTO, runtime protocol, catalog, pairing |
| `@howling/web` | [`apps/web`](../apps/web) | React Router, Vanilla Extract, React Flow 편집기 |
| `@howling/api` | [`apps/api`](../apps/api) | Fastify, 세션, pairing, flow/revision/deployment, inbound MCP, WSS |
| `@howling/runtime` | [`apps/runtime`](../apps/runtime) | SQLite coordinator, HA connector, 로컬 setup |
| `@howling/oidc-test` | [`infra/oidc`](../infra/oidc) | 개발·E2E 전용 OIDC issuer |
| `howling-e2e` | [`e2e`](../e2e) | Playwright. 워크스페이스 패키지가 아님 |

루트 명령:

```bash
pnpm dev          # postgres·oidc 후 api·runtime·web
pnpm dev:deps     # postgres·oidc만
pnpm dev:cloud    # 집 runtime·HA만. API는 app.howling.life
pnpm dev:ha       # 로컬 Home Assistant
pnpm test         # 단위·계약·integration
pnpm typecheck    # 전체 타입 검사
pnpm build        # shared packages와 세 앱
pnpm test:e2e     # 테스트 CA + Compose + Playwright
```

## `@howling/core` 안 구조

세부 폴더는 **같은 패키지**입니다. `@howling/compiler`처럼 쪼개지 않습니다.

```text
packages/core/
  src/
    index.ts          공개 export
    contracts/        타입 계약
    json/             Pointer, clone, schema, fingerprint
    registry/         type+version 등록
    compiler/         정의 검증과 실행 계획
    runtime/          startRun, step, command, snapshot
    effects/          안정적인 effect ID
    drivers/          자동 실행, dry-run, live adapter 주입
    nodes/            공식 노드
  tests/              Vitest
  examples/           JSON 예제와 브라우저 smoke
  README.md           짧은 사용법
```

Host(편집기, runtime, 이후 MCP)는 `src/index.ts`가 내보내는 것만 보면 됩니다.

## Core가 의존하지 않는 것

- React, React Flow
- Home Assistant SDK
- MCP SDK
- 데이터베이스, HTTP 서버, 파일 I/O
- `Date.now()`, `Math.random()`, 환경변수로 결과 결정

실행 결과는 호출자가 넣은 `runId`, 논리 시간, 입력, 초기 상태, 외부 응답으로만 정해집니다.

## 제품 패키지 경계

- `contracts`는 browser-safe다. React·DB·HTTP 클라이언트를 넣지 않는다.
- HA 구현은 `apps/runtime/src/ha/`에 있다. `packages/connectors`는 없다. web dependency graph로 가져오지 않는다.
- Web은 로컬 compile을 위해 `@howling/core`를 의존해도 된다. React는 core에 없다.
- HA 액션은 새 core 노드가 아니다. `core.effect` + adapter `homeassistant` / `call_service`다.
- Catalog의 기본 effect 이름은 `external` / `invoke`다. contracts 패키지 경계 테스트가 `homeassistant` 문자열을 금지한다. 편집기가 저장할 때 adapter를 바꾼다.

## 스타일

Web은 Vanilla Extract다. Tailwind, `cn`, `clsx`, `tailwind-merge`는 쓰지 않는다. 토큰은 `apps/web/src/styles/theme.css.ts`, 화면 스타일은 옆의 `*.css.ts` recipe다.

다음: [제품 개요](./product/01-overview.md) 또는 [Core가 하는 일](./core/01-overview.md)
