/**
 * 이번 전이의 이벤트만 모은다.
 * snapshot에는 이벤트 전체를 넣지 않고 lastEventSeq만 남긴다.
 */
import type { ExecutionEvent, ExecutionEventType } from "../contracts/event.js";
import type { ExecutionState } from "../contracts/state.js";

export interface EventCollector {
  sequence: number;
  readonly events: ExecutionEvent[];
}

export const createCollector = (state: ExecutionState): EventCollector => ({
  sequence: state.lastEventSeq,
  events: [],
});

export const nextSeq = (collector: EventCollector): number => {
  collector.sequence += 1;
  return collector.sequence;
};

export const emit = (
  collector: EventCollector,
  state: ExecutionState,
  event: { readonly type: ExecutionEventType } & Record<string, unknown>,
): ExecutionEvent => {
  const complete = {
    ...event,
    runId: state.runId,
    sequence: nextSeq(collector),
    logicalTime: state.logicalTime,
  } as ExecutionEvent;
  collector.events.push(complete);
  return complete;
};

export const sealEvents = (
  state: ExecutionState,
  collector: EventCollector,
): ExecutionState => ({
  ...state,
  lastEventSeq: collector.sequence,
});
