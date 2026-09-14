# 패키지 지도

Howling은 pnpm 워크스페이스입니다. 첫 구현은 패키지를 하나만 둡니다. 폴더마다 npm 패키지를 쪼개지 않습니다.

## 현재 패키지

| 이름 | 경로 | 역할 |
| --- | --- | --- |
| `howling` (private root) | `/` | 워크스페이스 스크립트. 앱이 아니다. |
| `@howling/core` | [`packages/core`](../packages/core) | 플로 compile, 단계 실행, effect intent, dry-run |

루트 스크립트는 core로 위임합니다.

```bash
pnpm test        # @howling/core 테스트
pnpm typecheck   # @howling/core 타입 검사
pnpm build       # @howling/core tsc
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

## 앞으로 붙을 패키지 (아직 없음)

설계상 Host는 Core의 `compile` 진단, `Transition.events`, `EffectRequest`만 보면 됩니다.

| 예정 | Core에 연결하는 위치 |
| --- | --- |
| React Flow 편집기 | `WorkflowDefinition` 생성, compile 진단 표시, 이벤트 표시 |
| HA adapter | HA 이벤트를 run 입력으로, external effect 수행 |
| MCP client/server | 도구를 노드로, 같은 compile·run·snapshot |
| 로컬 runner | 실제 clock, trigger, 영속 state, outbox |

이 문서의 나머지 장은 전부 `@howling/core` 자습서입니다.

다음: [Core가 하는 일](./core/01-overview.md)
