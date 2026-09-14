/**
 * 편집기 시험용 기본 fixture.
 */
import type { WorkflowDefinition } from "@howling/core";

export const defaultTestFixtures = (definition: WorkflowDefinition) =>
  definition.nodes
    .filter((node) => node.type === "core.effect")
    .map((node) => ({
      nodeId: node.id,
      index: 0,
      response: { source: "fixture" as const, status: "succeeded" as const, value: { ok: true } },
    }));
