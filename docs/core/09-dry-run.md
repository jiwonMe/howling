# Dry run

Dry-run은 실제 adapter를 받지 않습니다. `source: "live"` 응답은 성공이든 실패든 거부합니다. 모든 외부 작업은 fixture 또는 기록 응답으로만 진행합니다.

## Fixture

묶는 키는 `nodeId` + effect `index`입니다. `adapter`, `operation`, `input`을 적으면 요청과 일치하는지도 검사합니다. 다르거나 없으면 실제 adapter로 우회하지 않고 `needs-input`으로 남습니다.

```ts
type EffectFixture = {
  nodeId: string;
  index: number;
  adapter?: string;
  operation?: string;
  input?: unknown;
  at?: number;    // 이 논리 시간 이전에는 적용하지 않음
  order?: number; // 같은 시각의 전달 순서
  response: EffectResponse;
};
```

## 대표 시나리오: 전력 알림

정의는 [`packages/core/examples/power-alert.json`](../../packages/core/examples/power-alert.json)과 같습니다.

전체 스크립트 (`scripts`를 저장소 루트에 둔다고 가정):

```js
import { readFileSync } from "node:fs";
import {
  createEngine,
  createOfficialRegistry,
  createDryRunDriver,
} from "./packages/core/dist/index.js";

const definition = JSON.parse(
  readFileSync(new URL("../packages/core/examples/power-alert.json", import.meta.url), "utf8"),
);

const engine = createEngine({ registry: createOfficialRegistry() });
const compiled = engine.compile(definition);
if (!compiled.ok) {
  throw new Error(compiled.diagnostics.map((d) => d.message).join("\n"));
}

const fixtures = [
  {
    nodeId: "notify",
    index: 0,
    adapter: "test.notifications",
    operation: "send",
    response: {
      source: "fixture",
      status: "succeeded",
      value: { accepted: true },
    },
  },
];

const started = engine.startRun(compiled.plan, { power: 1400 }, {
  runId: "power-1",
  mode: "dryRun",
  logicalTime: 0,
  initialState: { mean: [800, 900, 1100, 1200] },
});

const result = engine.run(
  compiled.plan,
  started.transition.state,
  createDryRunDriver({ fixtures }),
);

console.log({
  status: result.status,
  mean: result.state.outputs.mean,
  proposed: result.state.proposedState.mean,
  notify: result.state.nodes.notify.status,
  notifyOut: result.state.outputs.notify,
});
```

기대:

```js
{
  status: "terminal",
  mean: { mean: 1080, count: 5 },
  proposed: [800, 900, 1100, 1200, 1400],
  notify: "completed",
  notifyOut: { result: { accepted: true } },
}
```

입력을 `{ power: 500 }`으로 바꾸면 평균은 `900`이고 `notify`는 `skipped`입니다. fixture는 쓰이지 않습니다.

fixture 배열을 `[]`로 두면 `needs-input`이고 `notify`는 `waiting`입니다.

`response.source`를 `"live"`로 바꿔도 dry-run은 적용하지 않고 대기합니다.

## ALL / ANY 응답 순서

[`packages/core/examples/all-any.json`](../../packages/core/examples/all-any.json)을 ALL 그대로 돌리면 두 조회가 끝난 뒤 `{ values: { a: "A", b: "B" } }`가 됩니다.

ANY로 바꾼 뒤 fixture `order`만 바꿉니다.

```js
const fixtures = (order) => [
  {
    nodeId: "lookupA",
    index: 0,
    adapter: "test.lookup",
    operation: "a",
    order: order.indexOf("a"),
    response: { source: "fixture", status: "succeeded", value: "A" },
  },
  {
    nodeId: "lookupB",
    index: 0,
    adapter: "test.lookup",
    operation: "b",
    order: order.indexOf("b"),
    response: { source: "fixture", status: "succeeded", value: "B" },
  },
];

// fixtures(["b", "a"]) → ANY source는 "b"
// fixtures(["a"]).slice(0)만 주면 ALL은 join이 idle인 채 needs-input
```

한쪽 fixture가 없어도 다른 준비 노드와 due timer는 진행합니다. 미해소 경로가 있으면 전체를 완료로 표시하지 않습니다.

## Timer

```js
const definition = {
  schemaVersion: 1,
  id: "wait",
  revision: "v1",
  entryNodeId: "input",
  nodes: [
    { id: "input", type: "core.input", version: 1, config: {}, inputs: {} },
    { id: "wait", type: "core.delay", version: 1, config: { durationMs: 50 }, inputs: {} },
  ],
  edges: [
    { id: "e1", source: { nodeId: "input", port: "success" }, target: { nodeId: "wait", port: "in" } },
  ],
};

const result = engine.run(
  plan,
  engine.startRun(plan, {}, { runId: "t", mode: "dryRun", logicalTime: 1000 }).transition.state,
  createDryRunDriver({ fixtures: [] }),
);

// result.state.logicalTime === 1050
// result.state.outputs.wait === { elapsedMs: 50 }
```

driver가 `clock.advanced` 다음에 timer resolve를 넣습니다. `Date.now()`는 읽지 않습니다.

## step과 run이 같아야 한다

같은 입력·fixture로 `step`을 반복한 최종 출력은 `run`과 같아야 합니다. 테스트 `tests/drivers/power-alert.test.ts`가 이 계약을 지킵니다.

다음: [Snapshot과 Host](./10-snapshot-and-host.md)
