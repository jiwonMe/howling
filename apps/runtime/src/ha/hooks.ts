/**
 * 테스트 hook. outgoing HA 호출을 기록한다.
 */
export interface HaServiceCall {
  readonly id: number;
  readonly domain: string;
  readonly service: string;
}

export interface HaCallLog {
  readonly calls: HaServiceCall[];
  readonly record: (call: HaServiceCall) => void;
}

export const createHaCallLog = (): HaCallLog => {
  const calls: HaServiceCall[] = [];
  return {
    calls,
    record: (call) => {
      calls.push(call);
    },
  };
};
