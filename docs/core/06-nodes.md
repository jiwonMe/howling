# 공식 노드

모든 노드는 `error` 제어 포트와 `error` 데이터 출력을 core가 예약합니다. 성공 시 `error` 엣지는 skipped입니다. 사용자 출력이 `error`라는 이름을 쓸 수 없습니다.

일반 노드의 제어 입력 이름은 `in`, 성공 출력은 대개 `success`입니다. 조건만 `true` / `false`입니다.

## `core.input`

실행 입력 전체를 `value`로 게시합니다. entry 노드입니다. 제어 입력이 있으면 compile이 거부합니다.

```json
{ "id": "input", "type": "core.input", "version": 1, "config": {}, "inputs": {} }
```

출력: `{ "value": <runInput> }`

## `core.map`

해석된 입력 필드를 객체로 묶습니다. n8n처럼 item마다 자동 반복하지 않습니다.

```json
{
  "id": "copy",
  "type": "core.map",
  "version": 1,
  "config": {},
  "inputs": {
    "name": { "kind": "literal", "value": "boiler" },
    "power": { "kind": "output", "nodeId": "input", "output": "value", "path": "/power" }
  }
}
```

출력: `{ "value": { "name": "boiler", "power": 1400 } }`

## `core.condition`

`config.operator`로 비교하고 `true` 또는 `false` 중 하나만 활성화합니다.

| operator | 입력 | 규칙 |
| --- | --- | --- |
| `eq`, `neq` | left, right | JSON 동등 비교 |
| `gt`, `gte`, `lt`, `lte` | left, right | **둘 다 number**. 문자열 `"10"`은 변환하지 않음 |
| `isTrue`, `isFalse` | left | left가 boolean이어야 함 |
| `in`, `notIn` | left, right | **right가 배열**. 원소와 left를 JSON 동등 비교 |

출력: `{ "result": true }` 또는 `{ "result": false }`

```json
{
  "id": "threshold",
  "type": "core.condition",
  "version": 1,
  "config": { "operator": "gt" },
  "inputs": {
    "left": { "kind": "output", "nodeId": "mean", "output": "mean" },
    "right": { "kind": "literal", "value": 1000 }
  }
}
```

문자열·불리언은 `eq` / `in`으로 비교합니다. 숫자는 문자열 `"10"`으로 바꾸지 않습니다.

```json
{
  "id": "weather",
  "type": "core.condition",
  "version": 1,
  "config": { "operator": "in" },
  "inputs": {
    "left": { "kind": "output", "nodeId": "readWeather", "output": "value", "path": "/state" },
    "right": { "kind": "literal", "value": ["cloudy", "rainy", "fog"] }
  }
}
```

```json
{
  "id": "sat",
  "type": "core.condition",
  "version": 1,
  "config": { "operator": "eq" },
  "inputs": {
    "left": { "kind": "output", "nodeId": "input", "output": "value", "path": "/sit" },
    "right": { "kind": "literal", "value": true }
  }
}
```

선택되지 않은 포트에 달린 엣지는 `skipped`가 되고, 그 하류는 skip으로 끝납니다.

## `analysis.rolling-mean`

최근 N개 숫자의 평균입니다. 시간 윈도우나 late event는 다루지 않습니다.

```json
{
  "id": "mean",
  "type": "analysis.rolling-mean",
  "version": 1,
  "config": { "windowSize": 5 },
  "inputs": {
    "value": { "kind": "output", "nodeId": "input", "output": "value", "path": "/power" }
  }
}
```

`startRun`의 `initialState.mean`이 이전 값 배열입니다. 없음과 `null`은 다릅니다.

입력 `{ power: 1400 }`, 초기 `[800, 900, 1100, 1200]`:

- 출력 `{ "mean": 1080, "count": 5 }`
- `proposedState.mean` = `[800, 900, 1100, 1200, 1400]`

원본 `initialState` 배열은 그대로입니다.

## `core.effect` / `core.delay`

외부 작업과 타이머입니다. [Effect와 시간](./08-effects-and-time.md)에서 다룹니다.

## `core.all` / `core.any`

합류입니다. [분기와 합류](./07-branch-and-join.md)에서 다룹니다.

## 노드 구현 계약

직접 등록할 때 지키는 규칙입니다. 자세한 예는 [커스텀 노드](./11-custom-nodes.md)에 있습니다.

```ts
type NodeOutcome =
  | { kind: "complete"; outputs: JsonObject; nextState?: JsonValue; activate: string[] }
  | { kind: "fail"; error: CoreError }
  | { kind: "wait"; effect: EffectIntent; continuation: JsonValue };
```

- `activate`에 없는 정상 포트는 skipped
- 선언하지 않은 포트를 켜면 노드 실패
- `wait`이면 `resume`이 필수
- 입출력 JSON은 읽기 전용으로 받고, 반영 전에 복사·검증합니다

다음: [분기와 합류](./07-branch-and-join.md)
