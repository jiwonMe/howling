/**
 * Dry-run fixture. adapter 불일치는 기본 성공 fixture로 메운다.
 */
import type { EffectFixture, WorkflowDefinition } from "@howling/core";

export const fixturesFromDefinition = (definition: unknown): EffectFixture[] => {
  if (!definition || typeof definition !== "object" || !("nodes" in definition)) {
    return [];
  }
  const nodes = (definition as WorkflowDefinition).nodes ?? [];
  return nodes
    .filter((node) => node.type === "core.effect")
    .map((node) => ({
      nodeId: node.id,
      index: 0,
      response: {
        source: "fixture" as const,
        status: "succeeded" as const,
        value: { ok: true },
      },
    }));
};

export const mergeFixtures = (
  provided: readonly EffectFixture[],
  definition: unknown,
): EffectFixture[] => {
  const defaults = fixturesFromDefinition(definition);
  const keys = new Set(provided.map((item) => `${item.nodeId}:${String(item.index)}`));
  return [
    ...provided.map((item) => ({
      nodeId: item.nodeId,
      index: item.index,
      response: item.response,
      ...(item.at === undefined ? {} : { at: item.at }),
      ...(item.order === undefined ? {} : { order: item.order }),
    })),
    ...defaults.filter((item) => !keys.has(`${item.nodeId}:${String(item.index)}`)),
  ];
};
