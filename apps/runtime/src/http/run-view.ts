/**
 * 로컬 HTTP run 조회 DTO.
 */
import { listEvents } from "../store/events.js";
import { listOutbox } from "../store/outbox.js";
import { getRun } from "../store/runs.js";
import type Database from "better-sqlite3";

export interface RunView {
  readonly runId: string;
  readonly status: string;
  readonly progressionMode: string;
  readonly lastSeq: number;
  readonly outbox: readonly {
    readonly effectId: string;
    readonly status: string;
    readonly intent: unknown;
  }[];
  readonly unknownEffects: readonly {
    readonly effectId: string;
    readonly reason: string;
  }[];
}

export const readRunView = (
  db: Database.Database,
  runId: string,
): RunView | undefined => {
  const run = getRun(db, runId);
  if (!run) {
    return undefined;
  }
  const outbox = listOutbox(db, runId);
  return {
    runId,
    status: run.status,
    progressionMode: run.progressionMode,
    lastSeq: run.lastEventSeq,
    outbox: outbox.map((row) => ({
      effectId: row.effectId,
      status: row.status,
      intent: row.intent,
    })),
    unknownEffects: outbox.flatMap((row) => {
      if (row.status !== "unknown") {
        return [];
      }
      const reason =
        row.response && row.response.status === "unknown"
          ? row.response.reason
          : "unknown";
      return [{ effectId: row.effectId, reason }];
    }),
  };
};

export const readRunEvents = (db: Database.Database, runId: string) => {
  if (!getRun(db, runId)) {
    return undefined;
  }
  return listEvents(db, runId);
};
