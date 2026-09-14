/**
 * 단일 writer가 공유하는 실행 맥락.
 */
import type {
  CompiledWorkflow,
  HowlingEngine,
  Transition,
} from "@howling/core";
import type Database from "better-sqlite3";
import type { FakeAdapter } from "../effects/fake-adapter.js";
import type { TimerScheduler } from "../timer/scheduler.js";
import type { InboxHandle } from "./inbox.js";

export type AfterCommit = "continue" | "halt";

export type AfterCommitHint = {
  readonly runId: string;
  readonly transition: Transition;
};

export interface HostContext {
  readonly db: Database.Database;
  readonly engine: HowlingEngine;
  readonly inbox: InboxHandle;
  readonly adapter: FakeAdapter;
  readonly timers: TimerScheduler;
  readonly now: () => number;
  readonly plans: Map<string, CompiledWorkflow>;
  readonly afterCommit: (hint: AfterCommitHint) => AfterCommit;
}
