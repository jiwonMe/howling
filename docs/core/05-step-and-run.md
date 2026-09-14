# step과 run

실행에는 두 축이 있습니다.

| 축 | 값 |
| --- | --- |
| 환경 | `live`, `dryRun` |
| 진행 | 수동 `step`, 자동 `run` |

Live에서도 한 칸씩 갈 수 있고, dry-run도 끝까지 자동으로 갈 수 있습니다. 도중에 mode를 바꾸지 않습니다.

## startRun

```ts
const started = engine.startRun(plan, { temperature: 30 }, {
  runId: "run-1",
  mode: "dryRun",
  logicalTime: 0,
  initialState: {},
});
```

- 입력과 `initialState`는 **복사**만 합니다. 원본 객체를 바꾸지 않습니다.
- entry만 `ready`입니다.
- `run.started`와 `node.ready`가 나옵니다.

## step — 노드 하나

`step`은 준비 큐 맨 앞 노드를 시작해 완료·실패·대기까지 갑니다.

- 하류 노드는 엣지만 해소하고, **자동으로 시작하지 않습니다**. 다음 `step`이 시작합니다.
- Effect가 필요하면 즉시 `waiting`과 `EffectRequest`를 반환합니다. Kernel은 I/O를 기다리지 않습니다.
- `pause` 중이면 새 노드를 시작하지 않습니다.
- `cancel` 뒤에는 step이 거부됩니다.

전체 스크립트:

```js
import { createEngine, createOfficialRegistry } from "../packages/core/dist/index.js";

const engine = createEngine({ registry: createOfficialRegistry() });

const definition = {
  schemaVersion: 1,
  id: "steps",
  revision: "v1",
  entryNodeId: "input",
  nodes: [
    { id: "input", type: "core.input", version: 1, config: {}, inputs: {} },
    {
      id: "copy",
      type: "core.map",
      version: 1,
      config: {},
      inputs: { payload: { kind: "output", nodeId: "input", output: "value" } },
    },
  ],
  edges: [
    {
      id: "e1",
      source: { nodeId: "input", port: "success" },
      target: { nodeId: "copy", port: "in" },
    },
  ],
};

const compiled = engine.compile(definition);
if (!compiled.ok) throw new Error("compile");

let state = engine.startRun(compiled.plan, { ok: true }, {
  runId: "s1",
  mode: "dryRun",
  logicalTime: 0,
}).transition.state;

console.log("after start", state.readyQueue, state.nodes.input.status);

const first = engine.step(compiled.plan, state);
state = first.transition.state;
console.log("after input", state.readyQueue, state.outputs.input);

const second = engine.step(compiled.plan, state);
state = second.transition.state;
console.log("after copy", state.status, state.outputs.copy);
```

기대:

1. start 후 `readyQueue`는 `["input"]`
2. 첫 step 후 `copy`가 ready, `input` 출력 `{ value: { ok: true } }`
3. 둘째 step 후 run `completed`, `copy` 출력 `{ value: { payload: { ok: true } } }`

fan-out이면 큐는 `["a", "z"]`처럼 **이름순 + 위상**으로 고정됩니다. 좌표와 무관합니다.

## run — 같은 kernel을 반복

`run`은 새 로직이 없습니다.

1. `readyQueue`가 있으면 `step`
2. 없으면 driver의 `nextCommands`를 `applyCommand`
3. 종료·pause·외부 입력 대기면 멈춤

반환:

| `status` | 의미 |
| --- | --- |
| `terminal` | `completed` / `failed` / `cancelled` |
| `paused` | pause 중 |
| `needs-input` | fixture 누락, 결과 불명 등 새 외부 입력이 필요 |

준비 노드를 **먼저** 모두 시작해 여러 effect가 동시에 대기할 수 있게 한 다음, fixture를 반영합니다. 한쪽 조회만 시작하고 바로 응답하면 ANY 승자 시험이 불가능해집니다.

## 이벤트

이벤트는 읽기 전용 값입니다. Kernel 안에서 로거 콜백을 실행하지 않습니다.

대표 이름: `run.started`, `node.ready`, `node.started`, `node.completed`, `node.failed`, `node.skipped`, `edge.taken`, `effect.requested`, `node.stateUpdated`.

각 이벤트는 `runId`, 단조 `sequence`, `logicalTime`을 가집니다. snapshot에는 이벤트 전체를 쌓지 않고 `lastEventSeq`만 남깁니다. 로그 저장은 Host가 합니다.

다음: [공식 노드](./06-nodes.md)
