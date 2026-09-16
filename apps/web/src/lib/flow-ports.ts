/**
 * 노드 타입별 기본 출력·합류 포트.
 */
export const JOIN_TYPES = new Set(["core.all", "core.any"]);

export const isJoinType = (type: string): boolean => JOIN_TYPES.has(type);

export const outputOf = (type: string): string => {
  if (type === "analysis.rolling-mean") {
    return "mean";
  }
  if (type === "core.condition") {
    return "result";
  }
  if (type === "core.effect") {
    return "result";
  }
  if (type === "core.delay") {
    return "elapsedMs";
  }
  if (type === "core.all") {
    return "values";
  }
  if (type === "core.any") {
    return "value";
  }
  return "value";
};

export const joinNamesOf = (config: Readonly<Record<string, unknown>>): string[] => {
  const names = config.inputNames;
  if (!Array.isArray(names)) {
    return [];
  }
  const unique: string[] = [];
  for (const name of names) {
    if (typeof name !== "string") {
      continue;
    }
    const trimmed = name.trim();
    if (!trimmed || trimmed === "error" || unique.includes(trimmed)) {
      continue;
    }
    unique.push(trimmed);
  }
  return unique;
};

export const parseJoinNames = (raw: string): string[] => {
  const names = joinNamesOf({
    inputNames: raw.split(",").map((item) => item.trim()),
  });
  return names.length > 0 ? names : ["a"];
};
