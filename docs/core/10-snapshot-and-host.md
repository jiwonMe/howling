# Snapshot과 Host

## Snapshot

`snapshot(state)`는 버전 있는 JSON입니다. 현재 상태와 `lastEventSeq`만 담습니다. 과거 이벤트 배열을 누적하지 않습니다.

포함하는 것:

- workflow fingerprint, schema/snapshot version, 노드 버전
- 입력·출력, 분석 상태, continuation
- edge 상태, ready queue, effect 상태
- 논리 시간, 적용한 commandId

```js
const snap = engine.snapshot(state);
const restored = engine.restore(plan, snap);
if (!restored.ok) {
  throw new Error(restored.diagnostics.map((d) => d.message).join("\n"));
}
// restored.transition.effects === []  — 재발행하지 않는다
```

거부하는 경우:

- snapshot 버전 불일치
- fingerprint가 현재 plan과 다름 (그래프·노드 버전 변경)
- 노드 버전 불일치
- JSON이 아닌 상태

대기 중 복원해도 pending effect를 새 `effects`로 내보내지 않습니다. Host journal이 “아직 전달하지 않았다”고 확정한 항목만 Host가 처음 전달할 수 있습니다. 이미 나갔을 수 있는 작업은 자동 재전송하지 않습니다.

exactly-once는 snapshot만으로 보장하지 않습니다.

## Host가 할 일

권장 전달 순서:

1. 새 실행 상태와 effect intent를 저장한다
2. journal에 전달 시작을 쓰고 `effect.dispatchStarted`를 반영·저장한다
3. 실제 외부 작업을 호출한다
4. 확인된 결과를 `effect.resolved`로 넣고 상태·이벤트를 저장한다

독립 라이브러리에는 durable outbox나 DB 트랜잭션이 없습니다.

Live driver는 작업 함수를 **주입**받습니다. 네트워크 클라이언트는 패키지에 없습니다.

```js
import { createLiveDriver } from "@howling/core";

let calls = 0;
const driver = createLiveDriver({
  executeExternal: (request) => {
    calls += 1;
    return {
      source: "live",
      status: "succeeded",
      value: { echoed: request.intent.input },
    };
  },
});

const result = engine.run(plan, state, driver);
```

타이머가 due가 아니면 live driver도 해소하지 않습니다. 실제 대기는 Host가 측정합니다.

## 편집기·러너가 보면 되는 것

| Host 기능 | Core API |
| --- | --- |
| 빨간 필드 | `compile`의 `diagnostics[].path` |
| 실행 하이라이트 | `Transition.events` |
| 알림 버튼/로그 | `Transition.effects` |
| 이어하기 | `snapshot` / `restore` |
| 시험 재생 | `createDryRunDriver` + fixture |

Core는 관측 플러그인이 상태를 직접 고치게 하지 않습니다. 판단이 필요하면 노드로 등록합니다.

다음: [노드를 직접 등록](./11-custom-nodes.md)
