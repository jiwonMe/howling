/** run + node execution + 순번으로 안정적인 effect ID를 만든다. 복원 시에도 같다. */
export const effectId = (
  runId: string,
  nodeExecutionId: string,
  index: number,
): string => `${runId}:${nodeExecutionId}:${index}`;
