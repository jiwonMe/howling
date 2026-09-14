/**
 * Run summary SSE와 JSON cursor.
 */
import { errorBody, errorCodes } from "@howling/contracts";
import type { FastifyReply, FastifyRequest } from "fastify";
import type pg from "pg";
import { listJournalAfter, listJournalForRun } from "./journal.js";
import { presentRun } from "./present.js";
import { getRun } from "./runs.js";

export const readRunEvents = async (
  pool: pg.Pool,
  siteId: string,
  runId: string,
  after: number,
  runtimeId?: string,
) => {
  const row = await getRun(pool, siteId, runId);
  if (!row) {
    return undefined;
  }
  if (runtimeId) {
    const journal = await listJournalAfter(pool, runtimeId, after);
    if (journal.resync) {
      return { resync: true as const, run: row };
    }
  }
  const items = await listJournalForRun(pool, runId, after);
  return {
    resync: false as const,
    run: row,
    items,
    snapshot: presentRun(row),
  };
};

export const sendEventStream = async (
  request: FastifyRequest,
  reply: FastifyReply,
  pool: pg.Pool,
  siteId: string,
  runId: string,
  after: number,
  runtimeId?: string,
): Promise<void> => {
  const first = await readRunEvents(pool, siteId, runId, after, runtimeId);
  if (!first) {
    reply.code(404).send(errorBody(errorCodes.notFound, "run not found"));
    return;
  }
  if (first.resync) {
    reply.code(409).send(errorBody(errorCodes.resyncRequired, "cursor is outside retention"));
    return;
  }
  reply.hijack();
  reply.raw.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    connection: "keep-alive",
  });
  reply.raw.write(`event: snapshot\ndata: ${JSON.stringify(first.snapshot)}\n\n`);
  let cursor = after;
  const writeItems = (
    items: { syncSeq: number; item: unknown }[],
  ) => {
    for (const item of items) {
      cursor = item.syncSeq;
      reply.raw.write(`id: ${String(item.syncSeq)}\nevent: summary\ndata: ${JSON.stringify(item.item)}\n\n`);
    }
  };
  writeItems(first.items);
  const timer = setInterval(() => {
    void readRunEvents(pool, siteId, runId, cursor, runtimeId).then((next) => {
      if (!next || next.resync) {
        return;
      }
      writeItems(next.items);
    });
  }, 1000);
  request.raw.on("close", () => {
    clearInterval(timer);
    reply.raw.end();
  });
};
