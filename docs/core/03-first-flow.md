# 첫 플로

이 장에서는 조건 하나만 있는 플로를 컴파일하고 끝까지 실행합니다. 의존성은 워크스페이스의 `@howling/core`입니다.

## 준비

저장소 루트에서:

```bash
pnpm install
pnpm --filter @howling/core build
```

아래 스크립트는 `packages/core`를 빌드한 뒤 Node에서 ESM으로 실행하는 형태입니다. 파일로 저장해서 돌려도 됩니다.

`/tmp/howling-first-flow.mjs` (또는 워크스페이스 아무 곳):

```js
import {
  createEngine,
  createOfficialRegistry,
  createDryRunDriver,
} from "../packages/core/dist/index.js";

const definition = {
  schemaVersion: 1,
  id: "first-flow",
  revision: "v1",
  entryNodeId: "input",
  nodes: [
    {
      id: "input",
      type: "core.input",
      version: 1,
      config: {},
      inputs: {},
    },
    {
      id: "hot",
      type: "core.condition",
      version: 1,
      config: { operator: "gt" },
      inputs: {
        left: {
          kind: "output",
          nodeId: "input",
          output: "value",
          path: "/temperature",
        },
        right: { kind: "literal", value: 25 },
      },
    },
  ],
  edges: [
    {
      id: "e1",
      source: { nodeId: "input", port: "success" },
      target: { nodeId: "hot", port: "in" },
    },
  ],
};

const engine = createEngine({ registry: createOfficialRegistry() });
const compiled = engine.compile(definition);
if (!compiled.ok) {
  console.error(compiled.diagnostics);
  process.exit(1);
}

const started = engine.startRun(compiled.plan, { temperature: 30 }, {
  runId: "first-1",
  mode: "dryRun",
  logicalTime: 0,
});
if (!started.ok) {
  console.error(started.diagnostics);
  process.exit(1);
}

const result = engine.run(
  compiled.plan,
  started.transition.state,
  createDryRunDriver({ fixtures: [] }),
);

console.log(JSON.stringify(
  {
    status: result.status,
    run: result.state.status,
    outputs: result.state.outputs,
    edges: result.state.edges,
  },
  null,
  2,
));
```

워크스페이스 루트에서:

```bash
node /tmp/howling-first-flow.mjs
```

`import` 경로는 스크립트 위치에 맞게 고칩니다. 저장소 루트에 `scripts/first-flow.mjs`를 두고 `from "./packages/core/dist/index.js"` 로 가져오면 됩니다.

## 기대 결과

```json
{
  "status": "terminal",
  "run": "completed",
  "outputs": {
    "input": { "value": { "temperature": 30 } },
    "hot": { "result": true }
  },
  "edges": {
    "e1": "taken"
  }
}
```

입력을 `{ temperature: 10 }`으로 바꾸면 `hot.result`는 `false`입니다. `false` 포트에 엣지가 없으므로 그 경로는 그냥 끝납니다.

## 무엇을 확인했는가

1. `core.input`이 run 입력 전체를 `value`로 게시한다.
2. `core.condition`이 `/temperature`와 리터럴 `25`를 비교한다.
3. 숫자 문자열 `"30"`을 넣으면 자동 변환하지 않고 노드가 실패한다.

실패를 보려면 입력을 `{ temperature: "30" }`으로 바꾸고 다시 실행합니다. `hot`는 `INVALID_COMPARISON`으로 실패하고, 오류 포트가 없으면 run은 `failed`가 됩니다.

## 예제 JSON으로 이어가기

저장소에 이미 있는 대표 시나리오는 다음입니다.

- [`packages/core/examples/power-alert.json`](../../packages/core/examples/power-alert.json) — 이동 평균 + 알림
- [`packages/core/examples/all-any.json`](../../packages/core/examples/all-any.json) — 두 조회 합류

알림이 있는 전체 스크립트는 [Dry run](./09-dry-run.md)에 있습니다.

다음: [Compile과 진단](./04-compile.md)
