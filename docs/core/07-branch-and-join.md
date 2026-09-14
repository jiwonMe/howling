# 분기와 합류

일반 노드는 제어 입력이 **하나**입니다. 여러 경로가 만나면 `core.all` 또는 `core.any`를 둡니다.

## 조건 분기

조건은 `true` 또는 `false` 중 하나만 taken입니다. 한 출력 포트에 엣지가 여러 개면 그 경로를 **모두** 켭니다(fan-out).

더 이상 활성화될 수 없는 노드는 `skipped`로 끝나고 하류로 전파합니다.

## ALL

`config.inputNames`로 입력 이름을 선언합니다. 각 이름은 제어 포트이자 값 바인딩 이름입니다.

규칙:

- 모든 진입이 `pending`을 벗어날 때까지 기다린다
- 하나 이상 `taken`이고 `failed`가 없으면 한 번 실행
- 전부 `skipped`이면 ALL도 skipped
- `failed`가 있으면 `UPSTREAM_FAILED` (오류 포트가 있으면 그쪽으로)
- 출력 `values`는 **활성 입력만** key로 가진다. 건너뛴 입력의 key는 없다

예제: [`packages/core/examples/all-any.json`](../../packages/core/examples/all-any.json)

```json
{
  "id": "join",
  "type": "core.all",
  "version": 1,
  "config": { "inputNames": ["a", "b"] },
  "inputs": {
    "a": { "kind": "output", "nodeId": "lookupA", "output": "result" },
    "b": { "kind": "output", "nodeId": "lookupB", "output": "result" }
  }
}
```

한 조건 경로가 skip이면 `{ "values": { "a": ... } }`만 나옵니다. 하류는 `join.values`를 참조하면 됩니다. `lookupB.result`를 직접 참조하면 compile이 거부할 수 있습니다.

## ANY

최초로 `taken`이 된 입력이 승자입니다. 같은 전이 안의 동률은 **edge ID 사전순**입니다. wall clock이나 Promise 완료 우연에 맡기지 않습니다.

- 출력 `{ source, value }`
- 승자 바인딩만 읽는다
- 늦은 완료가 승자를 바꾸거나 다시 실행하지 않는다
- 다른 경로는 계속 돈다. 이미 시작한 외부 작업이 남을 수 있다
- 하류가 끝나도 남은 effect가 있으면 run은 완료가 아니다
- ANY 성공과 run 성공은 별개다. 다른 경로의 미처리 실패는 run에 남는다

같은 그래프에서 `type`만 `core.any`로 바꾸고, 맵 입력을 `source`/`value`로 바꾸면 됩니다.

```js
const anyDefinition = {
  ...allDefinition,
  id: "any-demo",
  nodes: allDefinition.nodes.map((node) => {
    if (node.id === "join") return { ...node, type: "core.any" };
    if (node.id === "mapped") {
      return {
        ...node,
        inputs: {
          source: { kind: "output", nodeId: "join", output: "source" },
          value: { kind: "output", nodeId: "join", output: "value" },
        },
      };
    }
    return node;
  }),
};
```

fixture `order`로 B를 먼저 해소하면 `source`는 `"b"`입니다. 자세한 실행은 [Dry run](./09-dry-run.md)을 봅니다.

## 오류 경로

노드가 실패하고 `error` 포트에 엣지가 있으면:

- 정상 포트는 skipped
- `error` 포트는 taken
- 데이터 출력은 `{ error: { code, message } }`
- 원래 오류는 `routed`로 기록되어 run 실패 판정에서 빠진다

오류 포트가 없으면 정상 하류는 `failed`로 해소되고 `UPSTREAM_FAILED`가 전파됩니다.

오류 처리 노드 자신이 다시 실패하면, 또 `error` 엣지가 있어야 흡수됩니다. 처리되지 않은 실패가 남아 있으면 run은 `failed`입니다.

```js
const definition = {
  schemaVersion: 1,
  id: "err",
  revision: "v1",
  entryNodeId: "input",
  nodes: [
    { id: "input", type: "core.input", version: 1, config: {}, inputs: {} },
    {
      id: "cond",
      type: "core.condition",
      version: 1,
      config: { operator: "gt" },
      inputs: {
        left: { kind: "output", nodeId: "input", output: "value" },
        right: { kind: "literal", value: 1 },
      },
    },
    {
      id: "handler",
      type: "core.map",
      version: 1,
      config: {},
      inputs: { err: { kind: "output", nodeId: "cond", output: "error" } },
    },
  ],
  edges: [
    { id: "e1", source: { nodeId: "input", port: "success" }, target: { nodeId: "cond", port: "in" } },
    { id: "e2", source: { nodeId: "cond", port: "error" }, target: { nodeId: "handler", port: "in" } },
  ],
};

// runInput이 문자열이면 gt가 실패하고 handler가 error 객체를 받는다.
```

다음: [Effect와 시간](./08-effects-and-time.md)
