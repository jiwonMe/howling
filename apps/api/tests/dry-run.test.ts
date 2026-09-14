import { describe, expect, it } from "vitest";
import { closeApi, loginCookies, postgresUp, startApi } from "./helpers.js";
import { appendSummaryBatch } from "../src/flows/journal.js";
import { getRun, upsertRunSummary } from "../src/flows/runs.js";

describe.skipIf(!postgresUp)("phase 3 test session and journal", () => {
  it("rejects dry-run and commands when runtime is offline", async () => {
    const ctx = await startApi();
    try {
      const { cookie, csrf } = await loginCookies(ctx.app, ctx.oidc);
      const siteId = ctx.config.bootstrapSiteId;
      const headers = { cookie, "x-csrf-token": csrf };
      const created = await ctx.app.inject({
        method: "POST",
        url: `/api/v1/sites/${siteId}/flows`,
        headers,
        payload: { name: "Test" },
      });
      const flowId = created.json().flowId as string;
      await ctx.app.inject({
        method: "PUT",
        url: `/api/v1/sites/${siteId}/flows/${flowId}/draft`,
        headers,
        payload: {
          expectedVersion: 1,
          definition: {
            schemaVersion: 1,
            id: flowId,
            revision: "draft",
            entryNodeId: "input",
            nodes: [{ id: "input", type: "core.input", version: 1, config: {}, inputs: {} }],
            edges: [],
          },
          triggers: [],
          connections: [],
        },
      });
      const session = await ctx.app.inject({
        method: "POST",
        url: `/api/v1/sites/${siteId}/flows/${flowId}/test-sessions`,
        headers,
        payload: {
          source: "draft",
          input: { power: 1400 },
          fixtures: [],
          idempotencyKey: "dry-1",
        },
      });
      expect(session.statusCode).toBe(409);
      expect(session.json().error.code).toBe("runtime_offline");
      const command = await ctx.app.inject({
        method: "POST",
        url: `/api/v1/sites/${siteId}/runs/missing/commands`,
        headers,
        payload: { type: "step", commandId: "c1" },
      });
      expect(command.statusCode).toBe(404);
    } finally {
      await closeApi(ctx);
    }
  });

  it("replays journal after a cursor without gaps", async () => {
    const ctx = await startApi();
    try {
      const siteId = ctx.config.bootstrapSiteId;
      const runtimeId = ctx.config.bootstrapRuntimeId;
      const batch = (syncSeq: number) => ({
        runtimeId,
        stream: "summary" as const,
        syncSeq,
        runId: "run-journal",
        flowId: "flow-journal",
        revisionId: "rev-journal",
        status: "running",
        lastSeq: syncSeq,
        trigger: { power: 1400 },
        items: [{ sequence: syncSeq, type: "run.started" }],
        runMode: "dryRun" as const,
      });
      await appendSummaryBatch(ctx.pool, siteId, runtimeId, batch(1));
      await appendSummaryBatch(ctx.pool, siteId, runtimeId, batch(2));
      await appendSummaryBatch(ctx.pool, siteId, runtimeId, batch(2));
      const { cookie } = await loginCookies(ctx.app, ctx.oidc);
      const events = await ctx.app.inject({
        method: "GET",
        url: `/api/v1/sites/${siteId}/runs/run-journal/events?after=1`,
        headers: { cookie },
      });
      expect(events.statusCode).toBe(200);
      const body = events.json() as {
        runMode: string;
        journal: { syncSeq: number }[];
      };
      expect(body.runMode).toBe("dryRun");
      expect(body.journal.map((item) => item.syncSeq)).toEqual([2]);
    } finally {
      await closeApi(ctx);
    }
  });

  it("keeps a newer run status when an older summary arrives later", async () => {
    const ctx = await startApi();
    try {
      const siteId = ctx.config.bootstrapSiteId;
      const runId = "run-order";
      await upsertRunSummary(ctx.pool, siteId, {
        runId,
        flowId: "flow-order",
        revisionId: "rev-order",
        status: "completed",
        lastSeq: 8,
        trigger: { power: 1400 },
        events: [{ sequence: 8, type: "run.completed" }],
        runMode: "dryRun",
      });
      await upsertRunSummary(ctx.pool, siteId, {
        runId,
        flowId: "flow-order",
        revisionId: "rev-order",
        status: "running",
        lastSeq: 3,
        trigger: { power: 1400 },
        events: [{ sequence: 3, type: "run.started" }],
        runMode: "dryRun",
      });
      const row = await getRun(ctx.pool, siteId, runId);
      expect(row?.status).toBe("completed");
      expect(Number(row?.last_seq)).toBe(8);
    } finally {
      await closeApi(ctx);
    }
  });
});
