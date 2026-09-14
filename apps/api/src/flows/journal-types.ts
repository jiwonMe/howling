/**
 * Summary batch 항목. 원본 payload는 넣지 않는다.
 */
export type SummaryItem = {
  readonly sequence: number;
  readonly type: string;
  readonly nodeId?: string;
  readonly status?: string;
};

export type SummaryBatch = {
  readonly runtimeId: string;
  readonly stream: "summary";
  readonly syncSeq: number;
  readonly runId: string;
  readonly flowId: string;
  readonly revisionId: string;
  readonly status: string;
  readonly lastSeq: number;
  readonly trigger: unknown;
  readonly items: readonly SummaryItem[];
  readonly runMode?: string;
};
