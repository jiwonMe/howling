/** compile 진단: 중복 ID, 순환, 도달 불가, 합류 규칙, 필수 참조 가용성. */
import { describe, expect, it } from "vitest";
import { engine, edge, node, powerAlertDefinition, workflow } from "../helpers.js";

describe("compile", () => {
  it("compiles the power-alert example", () => {
    const compiled = engine.compile(powerAlertDefinition());
    expect(compiled.ok).toBe(true);
    if (compiled.ok) {
      expect(compiled.plan.entryNodeId).toBe("input");
      expect(compiled.plan.fingerprint.length).toBe(16);
    }
  });

  it("rejects duplicate node ids", () => {
    const compiled = engine.compile(
      workflow(
        [node("input", "core.input"), node("input", "core.map")],
        [],
      ),
    );
    expect(compiled.ok).toBe(false);
    if (!compiled.ok) {
      expect(compiled.diagnostics.some((item) => item.code === "DUPLICATE_ID")).toBe(true);
    }
  });

  it("rejects unknown node types", () => {
    const compiled = engine.compile(workflow([node("input", "core.missing")], []));
    expect(compiled.ok).toBe(false);
    if (!compiled.ok) {
      expect(compiled.diagnostics[0]?.code).toBe("UNKNOWN_NODE_TYPE");
    }
  });

  it("rejects unknown control ports", () => {
    const compiled = engine.compile(
      workflow(
        [node("input", "core.input"), node("map", "core.map")],
        [edge("e1", ["input", "missing"], ["map", "in"])],
      ),
    );
    expect(compiled.ok).toBe(false);
    if (!compiled.ok) {
      expect(compiled.diagnostics.some((item) => item.code === "INVALID_CONTROL_PORT")).toBe(true);
    }
  });

  it("rejects cycles", () => {
    const compiled = engine.compile(
      workflow(
        [node("input", "core.input"), node("a", "core.map"), node("b", "core.map")],
        [
          edge("e1", ["input", "success"], ["a", "in"]),
          edge("e2", ["a", "success"], ["b", "in"]),
          edge("e3", ["b", "success"], ["a", "in"]),
        ],
      ),
    );
    expect(compiled.ok).toBe(false);
    if (!compiled.ok) {
      expect(compiled.diagnostics.some((item) => item.code === "CYCLE_DETECTED")).toBe(true);
    }
  });

  it("rejects unreachable nodes", () => {
    const compiled = engine.compile(
      workflow(
        [node("input", "core.input"), node("ghost", "core.map")],
        [],
      ),
    );
    expect(compiled.ok).toBe(false);
    if (!compiled.ok) {
      expect(compiled.diagnostics.some((item) => item.code === "UNREACHABLE_NODE")).toBe(true);
    }
  });

  it("rejects regular nodes with multiple control inputs", () => {
    const compiled = engine.compile(
      workflow(
        [
          node("input", "core.input"),
          node("left", "core.map"),
          node("right", "core.map"),
          node("sink", "core.map"),
        ],
        [
          edge("e1", ["input", "success"], ["left", "in"]),
          edge("e2", ["input", "success"], ["right", "in"]),
          edge("e3", ["left", "success"], ["sink", "in"]),
          edge("e4", ["right", "success"], ["sink", "in"]),
        ],
      ),
    );
    expect(compiled.ok).toBe(false);
    if (!compiled.ok) {
      expect(compiled.diagnostics.some((item) => item.code === "INVALID_JOIN")).toBe(true);
    }
  });

  it("rejects ALL port and binding mismatches", () => {
    const compiled = engine.compile(
      workflow(
        [
          node("input", "core.input"),
          node("left", "core.map"),
          node("join", "core.all", {}, { inputNames: ["a", "b"] }),
        ],
        [
          edge("e1", ["input", "success"], ["left", "in"]),
          edge("e2", ["input", "success"], ["join", "a"]),
          edge("e3", ["left", "success"], ["join", "a"]),
        ],
      ),
    );
    expect(compiled.ok).toBe(false);
    if (!compiled.ok) {
      expect(compiled.diagnostics.some((item) => item.code === "INVALID_JOIN")).toBe(true);
    }
  });

  it("rejects required references on the opposite condition branch", () => {
    const compiled = engine.compile(
      workflow(
        [
          node("input", "core.input"),
          node("cond", "core.condition", {
            left: { kind: "literal", value: true },
          }, { operator: "isTrue" }),
          node("truthy", "core.map", {
            value: { kind: "output", nodeId: "input", output: "value" },
          }),
          node("bad", "core.map", {
            stolen: { kind: "output", nodeId: "truthy", output: "value" },
          }),
        ],
        [
          edge("e1", ["input", "success"], ["cond", "in"]),
          edge("e2", ["cond", "true"], ["truthy", "in"]),
          edge("e3", ["cond", "false"], ["bad", "in"]),
        ],
      ),
    );
    expect(compiled.ok).toBe(false);
    if (!compiled.ok) {
      expect(
        compiled.diagnostics.some((item) => item.code === "UNAVAILABLE_REQUIRED_REFERENCE"),
      ).toBe(true);
    }
  });

  it("rejects required references from an ANY losing path", () => {
    const compiled = engine.compile(
      workflow(
        [
          node("input", "core.input"),
          node("a", "core.map", { v: { kind: "output", nodeId: "input", output: "value" } }),
          node("b", "core.map", { v: { kind: "output", nodeId: "input", output: "value" } }),
          node("join", "core.any", {
            a: { kind: "output", nodeId: "a", output: "value" },
            b: { kind: "output", nodeId: "b", output: "value" },
          }, { inputNames: ["a", "b"] }),
          node("after", "core.map", {
            stolen: { kind: "output", nodeId: "b", output: "value" },
          }),
        ],
        [
          edge("e1", ["input", "success"], ["a", "in"]),
          edge("e2", ["input", "success"], ["b", "in"]),
          edge("e3", ["a", "success"], ["join", "a"]),
          edge("e4", ["b", "success"], ["join", "b"]),
          edge("e5", ["join", "success"], ["after", "in"]),
        ],
      ),
    );
    expect(compiled.ok).toBe(false);
    if (!compiled.ok) {
      expect(
        compiled.diagnostics.some((item) => item.code === "UNAVAILABLE_REQUIRED_REFERENCE"),
      ).toBe(true);
    }
  });
});
