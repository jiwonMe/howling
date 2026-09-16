/**
 * 공식 노드 catalog. 구현은 core registry에 있다.
 * 버전 핀은 기존 artifact와 맞춘다. 종류를 늘려도 숫자를 바꾸지 않는다.
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
  {
    type: "core.map",
    version: 1,
    title: "Map",
    description: "해석된 필드를 한 객체로 묶는다.",
    defaultConfig: {},
  },
  {
    type: "core.delay",
    version: 1,
    title: "Delay",
    description: "지정한 시간만큼 기다린다.",
    defaultConfig: { durationMs: 1000 },
  },
  {
    type: "core.all",
    version: 1,
    title: "All",
    description: "이름 포트가 모두 와야 다음으로 간다.",
    defaultConfig: { inputNames: ["a", "b"] },
  },
  {
    type: "core.any",
    version: 1,
    title: "Any",
    description: "이름 포트 중 하나가 오면 다음으로 간다.",
    defaultConfig: { inputNames: ["a", "b"] },
  },
];
