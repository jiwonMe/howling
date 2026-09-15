import { DEFAULT_DATA_POLICY } from "@howling/contracts";
import { describe, expect, it } from "vitest";
import { putLocalPolicy } from "../src/data/policy.js";
import { tickObserver } from "../src/observe/tick.js";
import { createTestHost, startRun } from "./helpers.js";

describe("phase 5 observer", () => {
  it("records numeric samples once per cursor", async () => {
    const host = createTestHost();
    putLocalPolicy(host.db, {
      policy: { ...DEFAULT_DATA_POLICY },
      captureRaw: false,
      observations: {
        fields: [{ id: "mean", flowId: "power-alert", nodeId: "mean", pointer: "/mean" }],
      },
    });
    await startRun(host, { artifactId: "power-alert", input: { power: 800 } });
    tickObserver(host.db);
    const first = host.db
      .prepare(`SELECT COUNT(*) AS n FROM observation_samples`)
      .get() as { n: number };
    expect(first.n).toBeGreaterThan(0);
    tickObserver(host.db);
    const second = host.db
      .prepare(`SELECT COUNT(*) AS n FROM observation_samples`)
      .get() as { n: number };
    expect(second.n).toBe(first.n);
    host.stop();
    host.db.close();
  });

  it("does not throw into the run loop when observe journal fails", async () => {
    const host = createTestHost();
    putLocalPolicy(host.db, {
      policy: { ...DEFAULT_DATA_POLICY },
      captureRaw: false,
      observations: {
        fields: [{ id: "mean", flowId: "power-alert", nodeId: "mean", pointer: "/mean" }],
      },
    });
    await startRun(host, { artifactId: "power-alert", input: { power: 900 } });
    host.db.exec(`DROP TABLE summary_journal`);
    expect(() => tickObserver(host.db)).not.toThrow();
    host.stop();
    host.db.close();
  });
});
