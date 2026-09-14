# Effect와 시간

Core는 외부 시스템을 호출하지 않습니다. 노드가 `wait`을 반환하면 **intent**만 만들고, Host(또는 dry-run driver)가 응답을 `applyCommand`로 넣습니다.

## Effect 형태

```ts
type EffectIntent =
  | { kind: "external"; adapter: string; operation: string; input: JsonValue }
  | { kind: "timer"; dueAt: number };
```

- `adapter` / `operation`은 Host와의 이름 계약입니다. HA 서비스명을 Core가 해석하지 않습니다.
- intent `input`에 secret을 넣지 않습니다.
- ID는 `runId + nodeExecutionId + index`입니다. snapshot을 복원해도 같습니다.

응답:

```ts
{ source: "live" | "fixture" | "recorded" | "simulated" }
& (
  | { status: "succeeded"; value: JsonValue }
  | { status: "failed"; error: CoreError }
  | { status: "unknown"; reason: string }
)
```

`unknown`은 성공·실패로 추정하지 않습니다. `resume`을 호출하지 않습니다. 나중에 확인된 응답은 받습니다. 이미 확정된 결과를 바꾸면 거부합니다.

같은 `commandId`에 같은 payload는 no-op, 다른 payload는 `INVALID_COMMAND`입니다.

## `core.effect`

```json
{
  "id": "notify",
  "type": "core.effect",
  "version": 1,
  "config": { "adapter": "test.notifications", "operation": "send" },
  "inputs": {
    "request": {
      "kind": "literal",
      "value": { "message": "최근 전력 사용량이 기준을 초과했습니다." }
    }
  }
}
```

`start`는 wait을 반환합니다. `resume`이 성공이면 `{ result: <응답 value> }`를 게시합니다.

## `core.delay`

`config.durationMs` 또는 입력 `durationMs`를 씁니다. `dueAt = logicalTime + durationMs`인 timer를 요청합니다.

시간만 앞으로 간다고 하류가 실행되지 않습니다. due에 도달한 뒤 `effect.resolved`가 와야 노드가 끝납니다.

## command 전체 스크립트

```js
import { createEngine, createOfficialRegistry } from "../packages/core/dist/index.js";

const engine = createEngine({ registry: createOfficialRegistry() });

const definition = {
  schemaVersion: 1,
  id: "notify-once",
  revision: "v1",
  entryNodeId: "input",
  nodes: [
    { id: "input", type: "core.input", version: 1, config: {}, inputs: {} },
    {
      id: "notify",
      type: "core.effect",
      version: 1,
      config: { adapter: "test.notifications", operation: "send" },
      inputs: { request: { kind: "literal", value: { ok: true } } },
    },
  ],
  edges: [
    { id: "e1", source: { nodeId: "input", port: "success" }, target: { nodeId: "notify", port: "in" } },
  ],
};

const plan = engine.compile(definition).plan;
let state = engine.startRun(plan, {}, {
  runId: "fx-1",
  mode: "dryRun",
  logicalTime: 0,
}).transition.state;

state = engine.step(plan, state).transition.state; // input
const waiting = engine.step(plan, state);
state = waiting.transition.state;

const effect = waiting.transition.effects[0];
console.log(effect.id, effect.intent);

const resolved = engine.applyCommand(plan, state, {
  type: "effect.resolved",
  commandId: "cmd-1",
  effectId: effect.id,
  response: { source: "fixture", status: "succeeded", value: { accepted: true } },
});

state = resolved.transition.state;
console.log(state.nodes.notify.status); // completed
console.log(state.outputs.notify); // { result: { accepted: true } }
```

`effect.resolved`는 그 노드만 재개합니다. 하류가 있으면 ready가 되지만, 다음 `step`이 시작해야 실행됩니다.

## pause / resume / cancel

```js
engine.applyCommand(plan, state, { type: "run.pause", commandId: "p1" });
engine.applyCommand(plan, state, { type: "run.resume", commandId: "p2" });
engine.applyCommand(plan, state, { type: "run.cancel", commandId: "c1" });
```

- **pause**: 새 노드 시작 금지. 진행 중 effect 결과는 반영. pause 중 새 intent는 `requested`로만 보관하고 `effects` 배열에 다시 넣지 않음
- **resume**: 새 intent를 재발행하지 않음. 미전달 `requested`는 상태가 알려 주고, 전달 여부는 Host journal
- **cancel**: 하류·새 전달 금지. 늦은 결과는 `effect.lateResult`만. 분석 상태를 더 갱신하지 않음

Core의 pause/cancel은 기기 작업 rollback을 보장하지 않습니다. 이미 나간 호출의 중단은 Host의 best-effort입니다.

## 논리 시간

```js
engine.applyCommand(plan, state, {
  type: "clock.advanced",
  commandId: "t-1050",
  logicalTime: 1050,
});
```

뒤로 돌릴 수 없습니다. dry-run driver는 다음 timer/fixture 시각으로 이 command를 만듭니다.

다음: [Dry run](./09-dry-run.md)
