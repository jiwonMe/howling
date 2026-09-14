/**
 * 공식 노드 catalog. 구현은 core registry에 있다.
 */
export const NODE_CATALOG_VERSION = "2026.09.1";

export interface CatalogNode {
  readonly type: string;
  readonly version: number;
  readonly title: string;
  readonly description: string;
  readonly defaultConfig: Readonly<Record<string, unknown>>;
}

export const officialCatalog: readonly CatalogNode[] = [
  {
    type: "core.input",
    version: 1,
    title: "Input",
    description: "실행 입력을 value로 게시한다.",
    defaultConfig: {},
  },
  {
    type: "analysis.rolling-mean",
    version: 1,
    title: "Rolling mean",
    description: "최근 N개 숫자의 평균.",
    defaultConfig: { windowSize: 5 },
  },
  {
    type: "core.condition",
    version: 1,
    title: "Condition",
    description: "비교 후 true/false 포트.",
    defaultConfig: { operator: "gt" },
  },
  {
    type: "core.effect",
    version: 1,
    title: "Effect",
    description: "외부 adapter 호출.",
    defaultConfig: { adapter: "external", operation: "invoke" },
  },
];
