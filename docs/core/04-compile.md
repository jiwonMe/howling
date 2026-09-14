# Compile과 진단

`compile`은 그래프를 실행하기 전에 구조, 포트, DAG, 값 참조를 검사합니다. 사용자 실수는 예외가 아니라 `{ ok: false, diagnostics }`입니다.

## 하는 일

1. `schemaVersion`과 필수 필드
2. 노드·엣지 ID 중복, entry 존재
3. registry에서 `type + version`
4. config 스키마와 제어 포트
5. DAG, entry에서 도달 가능
6. 일반 노드 제어 입력 1개, ALL·ANY 포트·바인딩 일치
7. 출력 참조 존재와 **필수 가용성**
8. 인접 목록, 준비 큐 순위, fingerprint

준비 노드가 여러 개면 **위상 순서 + nodeId**로 줄을 세웁니다. 화면 좌표는 쓰지 않습니다.

## 진단 코드

| 코드 | 언제 |
| --- | --- |
| `INVALID_WORKFLOW` | schema, 필수 필드, JSON Pointer 형식 |
| `DUPLICATE_ID` | 노드 또는 엣지 ID 중복 |
| `UNKNOWN_NODE_TYPE` | 등록되지 않은 type@version |
| `INVALID_NODE_CONFIG` | config 스키마 위반, 합류 inputNames |
| `INVALID_CONTROL_PORT` | 없는 포트, 예약된 `error`를 spec이 선언 |
| `CYCLE_DETECTED` | 순환 |
| `UNREACHABLE_NODE` | entry에서 갈 수 없음 |
| `INVALID_JOIN` | 일반 노드에 제어 입력이 2개, ALL 포트 누락 |
| `UNKNOWN_OUTPUT_REFERENCE` | 없는 노드·출력 이름 |
| `UNAVAILABLE_REQUIRED_REFERENCE` | 반대 분기 등 보장할 수 없는 필수 참조 |
| `INPUT_SCHEMA_MISMATCH` | 실행 시 해석한 입력이 스키마와 다름 |
| `OUTPUT_SCHEMA_MISMATCH` | 노드 결과가 선언과 다름 |
| `INVALID_COMMAND` | 중복 충돌 command, 시간 되돌리기 |
| `INVALID_SNAPSHOT` | 버전·fingerprint 불일치 |
| `INVALID_JSON` | 실행 데이터가 JSON이 아님 |

각 항목은 `code`, `message`, 그리고 가능한 `nodeId` / `edgeId` / `path`를 가집니다. 편집기는 `path`로 필드를 강조하면 됩니다.

## 따라 하기: 순환을 고친다

```js
import { createEngine, createOfficialRegistry } from "../packages/core/dist/index.js";

const engine = createEngine({ registry: createOfficialRegistry() });

const cyclic = {
  schemaVersion: 1,
  id: "cycle",
  revision: "v1",
  entryNodeId: "input",
  nodes: [
    { id: "input", type: "core.input", version: 1, config: {}, inputs: {} },
    { id: "a", type: "core.map", version: 1, config: {}, inputs: {} },
    { id: "b", type: "core.map", version: 1, config: {}, inputs: {} },
  ],
  edges: [
    { id: "e1", source: { nodeId: "input", port: "success" }, target: { nodeId: "a", port: "in" } },
    { id: "e2", source: { nodeId: "a", port: "success" }, target: { nodeId: "b", port: "in" } },
    { id: "e3", source: { nodeId: "b", port: "success" }, target: { nodeId: "a", port: "in" } },
  ],
};

const compiled = engine.compile(cyclic);
console.log(compiled.ok);
if (!compiled.ok) {
  console.log(compiled.diagnostics);
}
```

기대: `ok: false`, 코드 `CYCLE_DETECTED`.

`e3`를 지우면 compile이 성공합니다. `unreachable` 노드를 남기면 `UNREACHABLE_NODE`가 납니다.

## 필수 참조 가용성

소비 노드가 실행될 때 생산자 출력이 **반드시** 준비되어야 합니다.

허용:

- 같은 단일 경로에서 이미 성공한 노드
- ALL이 만든 `values` 자체
- ANY가 만든 `source` / `value`

거부 (default나 명시적 합류가 필요):

- 반대 조건 분기에만 있는 노드
- ANY에서 질 수도 있는 경로의 출력
- 아직 안 끝난 독립 경로
- 실패한 노드의 정상 출력

```js
const opposite = {
  schemaVersion: 1,
  id: "opp",
  revision: "v1",
  entryNodeId: "input",
  nodes: [
    { id: "input", type: "core.input", version: 1, config: {}, inputs: {} },
    {
      id: "cond",
      type: "core.condition",
      version: 1,
      config: { operator: "isTrue" },
      inputs: { left: { kind: "literal", value: true } },
    },
    {
      id: "yes",
      type: "core.map",
      version: 1,
      config: {},
      inputs: { v: { kind: "output", nodeId: "input", output: "value" } },
    },
    {
      id: "no",
      type: "core.map",
      version: 1,
      config: {},
      inputs: { stolen: { kind: "output", nodeId: "yes", output: "value" } },
    },
  ],
  edges: [
    { id: "e1", source: { nodeId: "input", port: "success" }, target: { nodeId: "cond", port: "in" } },
    { id: "e2", source: { nodeId: "cond", port: "true" }, target: { nodeId: "yes", port: "in" } },
    { id: "e3", source: { nodeId: "cond", port: "false" }, target: { nodeId: "no", port: "in" } },
  ],
};

const result = engine.compile(opposite);
// UNAVAILABLE_REQUIRED_REFERENCE — no는 yes가 실행된다는 보장이 없다
```

`no`가 `yes` 값이 필요하면 ALL로 모으거나, `default`를 달거나, `yes`와 같은 분기에 둡니다.

다음: [step과 run](./05-step-and-run.md)
