/**
 * 한 SQLite transaction에 snapshot·event·outbox·command·분석 상태를 저장한다.
 */
import type {
  ExecutionEvent,
  HowlingEngine,
  Transition,
} from "@howling/core";
import type Database from "better-sqlite3";
import { insertEvents, recordCommand } from "../store/events.js";
import { applyStateUpdate } from "../store/node-states.js";
import { upsertOutbox } from "../store/outbox.js";
import { upsertRun } from "../store/runs.js";
import type { ProgressionMode } from "../store/triggers.js";

export const persistTransition = (
  db: Database.Database,
  engine: HowlingEngine,
  input: {
    readonly runId: string;
    readonly flowId: string;
    readonly artifactId: string;
    readonly revision: string;
    readonly stateEpoch: string;
    readonly progressionMode: ProgressionMode;
    readonly transition: Transition;
    readonly command?: {
      readonly commandId: string;
      readonly digest: string;
      readonly payload: unknown;
    };
  },
): void => {
  const work = db.transaction(() => {
    const snapshot = engine.snapshot(input.transition.state);
    const terminal = isTerminal(input.transition.state.status);
    upsertRun(db, {
      runId: input.runId,
      flowId: input.flowId,
      artifactId: input.artifactId,
      snapshot,
      status: input.transition.state.status,
      progressionMode: input.progressionMode,
      holding: !terminal,
      stateEpoch: input.stateEpoch,
      lastEventSeq: input.transition.state.lastEventSeq,
    });
    insertEvents(db, input.transition.events);
    for (const event of input.transition.events) {
      applyAnalysis(db, input, event);
    }
    for (const record of Object.values(input.transition.state.effects)) {
      upsertOutbox(db, {
        effectId: record.id,
        runId: record.runId,
        nodeId: record.nodeId,
        intent: record.intent,
        status: record.status,
        response: record.response ?? null,
      });
    }
    if (input.command) {
      recordCommand(db, {
        commandId: input.command.commandId,
        runId: input.runId,
        digest: input.command.digest,
        payload: input.command.payload,
      });
    }
  });
  work();
};

const isTerminal = (status: string): boolean =>
  status === "completed" || status === "failed" || status === "cancelled";

const applyAnalysis = (
  db: Database.Database,
  input: {
    readonly flowId: string;
    readonly revision: string;
    readonly stateEpoch: string;
    readonly runId: string;
  },
  event: ExecutionEvent,
): void => {
  if (event.type !== "node.stateUpdated") {
    return;
  }
  applyStateUpdate(db, {
    flowId: input.flowId,
    revision: input.revision,
    stateEpoch: input.stateEpoch,
    nodeId: event.nodeId,
    nextState: event.nextState,
    runId: input.runId,
    sequence: event.sequence,
  });
};
