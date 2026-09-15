import { describe, expect, it } from "vitest";
import type { GatewayHandle } from "../src/gateway/client.js";
import { flushUnackedSummaries, publishRunSummary } from "../src/gateway/summary.js";
import { listUnackedSummary } from "../src/store/summary-journal.js";
import { createTestHost, startDryRun, startRun } from "./helpers.js";

const fakeGateway = (sent: string[], open = { value: true }): GatewayHandle => ({
  stop: () => undefined,
  send: (type) => {
    if (!open.value) {
      return false;
    }
    sent.push(type);
    return true;
  },
  runtimeId: () => "runtime_dev",
  hold: () => undefined,
  release: () => undefined,
  setIdentity: () => undefined,
  setConnectors: () => undefined,
});

describe("phase 3 summary journal", () => {
  it("keeps publishing after a dropped cloud socket", async () => {
    const sent: string[] = [];
    const open = { value: true };
    const gateway = fakeGateway(sent, open);
    const host = createTestHost({
      afterCommit: (hint) => {
        publishRunSummary(host, gateway, hint.runId);
        return "continue";
      },
    });
    await startRun(host, { artifactId: "power-alert", input: { power: 800 } });
    expect(sent.filter((type) => type === "run.summary").length).toBeGreaterThan(0);
    open.value = false;
    const dropped = sent.length;
    await startRun(host, { artifactId: "power-alert", input: { power: 900 } });
    expect(sent.length).toBe(dropped);
    expect(listUnackedSummary(host.db).length).toBeGreaterThan(0);
    open.value = true;
    flushUnackedSummaries(host, gateway);
    expect(sent.filter((type) => type === "summary.batch").length).toBeGreaterThan(0);
    host.stop();
    host.db.close();
  });

  it("does not call the adapter during dry-run publish", async () => {
    const gateway = fakeGateway([]);
    const host = createTestHost({
      afterCommit: (hint) => {
        publishRunSummary(host, gateway, hint.runId);
        return "continue";
      },
    });
    await startDryRun(host, {
      artifactId: "power-alert",
      input: { power: 1400 },
      initialState: { mean: [800, 900, 1100, 1200] },
      fixtures: [
        {
          nodeId: "notify",
          index: 0,
          adapter: "test.notifications",
          operation: "send",
          response: { source: "fixture", status: "succeeded", value: { accepted: true } },
        },
      ],
    });
    expect(host.adapter.calls).toHaveLength(0);
    host.stop();
    host.db.close();
  });
});
