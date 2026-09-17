/**
 * 노드 타입별 화면 표시 정보. catalog 계약은 그대로 두고 웹에서만 덧입힌다.
 */
export type NodeCategory = "start" | "compute" | "branch" | "join" | "time" | "action";

export interface NodeMeta {
  readonly type: string;
  readonly label: string;
  readonly hint: string;
  readonly category: NodeCategory;
  readonly idBase: string;
}

export const CATEGORY_LABELS: Record<NodeCategory, string> = {
  start: "시작",
  compute: "계산",
  branch: "분기",
  join: "합류",
  time: "시간",
  action: "동작",
};

export const CATEGORY_ORDER: readonly NodeCategory[] = [
  "start",
  "compute",
  "branch",
  "join",
  "time",
  "action",
];

const META: readonly NodeMeta[] = [
  {
    type: "core.input",
    label: "입력",
    hint: "플로가 받은 값으로 시작",
    category: "start",
    idBase: "input",
  },
  {
    type: "analysis.rolling-mean",
    label: "이동 평균",
    hint: "최근 N개 숫자의 평균",
    category: "compute",
    idBase: "mean",
  },
  {
    type: "core.map",
    label: "값 묶기",
    hint: "여러 값을 한 객체로",
    category: "compute",
    idBase: "map",
  },
  {
    type: "core.condition",
    label: "조건",
    hint: "비교해서 참 · 거짓으로 나눔",
    category: "branch",
    idBase: "condition",
  },
  {
    type: "core.all",
    label: "모두 기다림",
    hint: "모든 입력이 오면 진행",
    category: "join",
    idBase: "all",
  },
  {
    type: "core.any",
    label: "먼저 온 것",
    hint: "하나라도 오면 진행",
    category: "join",
    idBase: "any",
  },
  {
    type: "core.delay",
    label: "대기",
    hint: "정한 시간만큼 기다림",
    category: "time",
    idBase: "delay",
  },
  {
    type: "core.effect",
    label: "동작",
    hint: "기기 · MCP · HA 실행",
    category: "action",
    idBase: "effect",
  },
];

const FALLBACK: NodeMeta = {
  type: "",
  label: "노드",
  hint: "",
  category: "compute",
  idBase: "node",
};

export const nodeMeta = (type: string): NodeMeta =>
  META.find((item) => item.type === type) ?? { ...FALLBACK, type, label: type };

export const nodeMetaList = (): readonly NodeMeta[] => META;

export const OPERATOR_LABELS: Record<string, { readonly symbol: string; readonly text: string }> = {
  eq: { symbol: "=", text: "같으면" },
  neq: { symbol: "≠", text: "다르면" },
  gt: { symbol: ">", text: "크면" },
  gte: { symbol: "≥", text: "크거나 같으면" },
  lt: { symbol: "<", text: "작으면" },
  lte: { symbol: "≤", text: "작거나 같으면" },
  isTrue: { symbol: "참", text: "참이면" },
  isFalse: { symbol: "거짓", text: "거짓이면" },
  in: { symbol: "∈", text: "목록에 있으면" },
  notIn: { symbol: "∉", text: "목록에 없으면" },
};

export const PORT_LABELS: Record<string, string> = {
  true: "참",
  false: "거짓",
  success: "다음",
  in: "입력",
};

export const portLabel = (port: string): string => PORT_LABELS[port] ?? port;

export const formatDuration = (ms: number): string => {
  if (!Number.isFinite(ms) || ms < 0) {
    return "0초";
  }
  if (ms >= 3_600_000 && ms % 3_600_000 === 0) {
    return `${String(ms / 3_600_000)}시간`;
  }
  if (ms >= 60_000 && ms % 60_000 === 0) {
    return `${String(ms / 60_000)}분`;
  }
  if (ms >= 1000 && ms % 1000 === 0) {
    return `${String(ms / 1000)}초`;
  }
  return `${String(ms)}ms`;
};
