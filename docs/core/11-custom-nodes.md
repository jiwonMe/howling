# 노드를 직접 등록

공식 노드로 부족하면 `createRegistry`에 spec과 implementation을 함께 등록합니다. 같은 `type + version`을 두 번 넣으면 예외가 납니다. 실행 중 교체는 없습니다.

노드는 **신뢰된 코드**입니다. Core는 임의 JavaScript sandbox가 아닙니다.

## 전체 예: 숫자를 두 배로

```js
import {
  createEngine,
  createRegistry,
  registerOfficialNodes,
} from "../packages/core/dist/index.js";

const doubleSpec = {
  type: "demo.double",
  version: 1,
  configSchema: { type: "object", additionalProperties: false },
  inputSchema: {
    type: "object",
    required: ["value"],
    additionalProperties: false,
    properties: { value: { type: "number" } },
  },
  outputSchema: {
    type: "object",
    required: ["value"],
    additionalProperties: false,
    properties: { value: { type: "number" } },
  },
  control: { inputs: ["in"], outputs: ["success"] },
};

const doubleImplementation = {
  start: (context) => {
    const value = context.inputs.value;
    if (typeof value !== "number") {
      return {
        kind: "fail",
        error: { code: "INPUT_SCHEMA_MISMATCH", message: "value must be a number" },
      };
    }
    return {
      kind: "complete",
      outputs: { value: value * 2 },
      activate: ["success"],
    };
  },
};

const registry = createRegistry();
registerOfficialNodes(registry);
registry.register(doubleSpec, doubleImplementation);

const engine = createEngine({ registry });

const definition = {
  schemaVersion: 1,
  id: "double-flow",
  revision: "v1",
  entryNodeId: "input",
  nodes: [
    { id: "input", type: "core.input", version: 1, config: {}, inputs: {} },
    {
      id: "twice",
      type: "demo.double",
      version: 1,
      config: {},
      inputs: {
        value: { kind: "output", nodeId: "input", output: "value", path: "/n" },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      source: { nodeId: "input", port: "success" },
      target: { nodeId: "twice", port: "in" },
    },
  ],
};

const plan = engine.compile(definition).plan;
const started = engine.startRun(plan, { n: 21 }, {
  runId: "d1",
  mode: "dryRun",
  logicalTime: 0,
});

let state = started.transition.state;
state = engine.step(plan, state).transition.state;
state = engine.step(plan, state).transition.state;

console.log(state.outputs.twice); // { value: 42 }
```

## wait이 있는 노드

`wait`을 반환하려면 `resume`이 있어야 합니다. 없으면 effect를 발행하기 **전에** 구현 오류로 실패합니다.

```js
const impl = {
  start: (context) => ({
    kind: "wait",
    effect: {
      kind: "external",
      adapter: "demo",
      operation: "fetch",
      input: context.inputs.request ?? null,
    },
    continuation: { stage: "awaiting" },
  }),
  resume: (_context, _continuation, response) => {
    if (response.status === "failed") {
      return { kind: "fail", error: response.error };
    }
    return {
      kind: "complete",
      outputs: { result: response.value },
      activate: ["success"],
    };
  },
};
```

재개 때 `inputs`와 `config`와 `previousState`는 시작과 같고, `logicalTime`만 현재 주입 값입니다.

## 스키마

`configSchema` / `inputSchema` / `outputSchema`는 JSON Schema subset입니다. 지원: `type`, `required`, `properties`, `additionalProperties`, `items`, `enum`, `const`, 숫자·문자열·배열 범위.

UI 색상·좌표·React 컴포넌트는 spec에 넣지 않습니다.

## 다음에 읽을 것

- 설계 원문: [`plan/core-plan.md`](../../plan/core-plan.md)
- 패키지 짧은 README: [`packages/core/README.md`](../../packages/core/README.md)
- 테스트가 곧 실행 계약입니다: `packages/core/tests/`

목차로 돌아가기: [문서 홈](../README.md)
