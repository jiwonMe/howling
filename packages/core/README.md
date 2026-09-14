# @howling/core

Howling 실행 커널입니다. 플로 정의를 검증하고, 노드를 단계적으로 평가하며, 외부 작업은 intent로만 남깁니다. Home Assistant, MCP, React, 데이터베이스에 의존하지 않습니다.

자습서: [`docs/README.md`](../../docs/README.md) — 개념부터 dry-run·커스텀 노드까지 순서대로 있습니다.

## 설치

워크스페이스 루트에서 `pnpm install` 후 `pnpm --filter @howling/core test`를 실행합니다.

## 공개 API

```ts
import {
  createEngine,
  createOfficialRegistry,
  createDryRunDriver,
} from "@howling/core";
import definition from "./examples/power-alert.json" with { type: "json" };

const engine = createEngine({ registry: createOfficialRegistry() });
const compiled = engine.compile(definition);
if (!compiled.ok) {
  throw new Error(compiled.diagnostics.map((item) => item.message).join("\n"));
}

const started = engine.startRun(compiled.plan, { power: 1400 }, {
  runId: "run-1",
  mode: "dryRun",
  logicalTime: 0,
  initialState: { mean: [800, 900, 1100, 1200] },
});
if (!started.ok) {
  throw new Error("start failed");
}

const result = engine.run(
  compiled.plan,
  started.transition.state,
  createDryRunDriver({
    fixtures: [
      {
        nodeId: "notify",
        index: 0,
        adapter: "test.notifications",
        operation: "send",
        response: { source: "fixture", status: "succeeded", value: { accepted: true } },
      },
    ],
  }),
);
```

`step`은 준비된 노드 하나만 진행합니다. `applyCommand`는 외부 응답, 논리 시간, pause/resume/cancel을 반영합니다. `snapshot` / `restore`는 실행 상태를 직렬화하며 pending effect를 다시 발행하지 않습니다.

## 결정성

실행 결과는 `Date.now()`, `Math.random()`, 네트워크, 파일, 환경변수에 의존하지 않습니다. `runId`, 논리 시간, 외부 응답은 호출자가 넣습니다. 같은 정의, 입력, 초기 상태, fixture 순서, 시간 진행이면 같은 출력·경로·effect intent가 나옵니다.

## Host 경계

Core는 adapter 이름과 operation만 기록합니다. 실제 HA 호출, credential, outbox, 프로세스 복구는 host가 담당합니다. Host는 `Transition.state`, `events`, `effects`를 받아 저장·표시·전달 여부를 결정합니다.

## 공식 노드

`core.input`, `core.map`, `core.condition`, `core.all`, `core.any`, `core.effect`, `core.delay`, `analysis.rolling-mean`

## 브라우저 smoke

HTML을 Finder나 `file://`로 열면 브라우저가 모듈을 차단합니다. 빌드 후 로컬 HTTP로 엽니다.

```bash
pnpm --filter @howling/core build
pnpm --filter @howling/core smoke:browser
```

브라우저에서 `http://127.0.0.1:4173/examples/browser-smoke.html` 을 엽니다. `{ "status": "terminal", "outputs": { "cond": { "result": true } } }` 가 보이면 통과입니다.
