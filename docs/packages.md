# 패키지 지도

Howling은 pnpm 워크스페이스입니다. Core는 독립 실행 엔진이고, 제품 앱은 같은 저장소에서 개발합니다.

## 현재 패키지와 앱

| 이름 | 경로 | 역할 |
| --- | --- | --- |
| `howling` (private root) | `/` | 워크스페이스 스크립트. 앱이 아니다. |
| `@howling/core` | [`packages/core`](../packages/core) | 플로 compile, 단계 실행, effect intent, dry-run |
| `@howling/contracts` | [`packages/contracts`](../packages/contracts) | REST DTO, runtime protocol, 제품 flow 타입 |
| `@howling/web` | [`apps/web`](../apps/web) | React 상태 화면. 편집기는 아직 없다. |
| `@howling/api` | [`apps/api`](../apps/api) | Fastify, 세션, runtime WebSocket 게이트웨이 |
| `@howling/runtime` | [`apps/runtime`](../apps/runtime) | 로컬 health와 API 연결. 실행 루프는 단계 1. |
| `@howling/oidc-test` | [`infra/oidc`](../infra/oidc) | 개발·테스트 전용 OIDC issuer |

루트 명령:

```bash
pnpm dev          # postgres·oidc 후 세 앱
pnpm test         # 단위·계약·integration
pnpm typecheck    # 전체 타입 검사
pnpm build        # shared packages와 세 앱
pnpm verify:phase0
```

## `@howling/core` 안 구조

세부 폴더는 **같은 패키지**입니다. 나중에 `@howling/compiler`처럼 쪼개지 않습니다.

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

Host(편집기, HA, MCP)는 `src/index.ts`가 내보내는 것만 보면 됩니다.

## Core가 의존하지 않는 것

- React, React Flow
- Home Assistant SDK
- MCP SDK
- 데이터베이스, HTTP 서버, 파일 I/O
- `Date.now()`, `Math.random()`, 환경변수로 결과 결정

실행 결과는 호출자가 넣은 `runId`, 논리 시간, 입력, 초기 상태, 외부 응답으로만 정해집니다.

## 제품 패키지 경계

- `contracts`는 browser-safe다. React·DB·HTTP 클라이언트를 넣지 않는다.
- `connectors`는 아직 없다. web dependency graph로 가져오지 않는다.
- Runtime은 `@howling/core`를 선언만 하고, 단계 0에서는 engine을 돌리지 않는다.

이 문서의 나머지 장은 `@howling/core` 자습서입니다.

다음: [Core가 하는 일](./core/01-overview.md)
