/**
 * 영속 runtime host. 단일 coordinator inbox를 소유한다.
 */
import { createEngine, createOfficialRegistry } from "@howling/core";
import type Database from "better-sqlite3";
import { seedArtifacts } from "../artifacts/seed.js";
import { createFakeAdapter, type FakeAdapter } from "../effects/fake-adapter.js";
import { createTimerScheduler, type TimerScheduler } from "../timer/scheduler.js";
import type { AfterCommit, AfterCommitHint, HostContext } from "./context.js";
import { createInbox, type InboxHandle } from "./inbox.js";
import { handleMessage } from "./loop.js";
import { recoverHost } from "./recovery.js";

export interface CreateRuntimeHostOptions {
  readonly db: Database.Database;
  readonly now?: () => number;
  readonly adapter?: FakeAdapter;
  readonly afterCommit?: (hint: AfterCommitHint) => AfterCommit;
  readonly useTimeout?: boolean;
  readonly seed?: boolean;
}

export interface RuntimeHost {
  readonly db: Database.Database;
  readonly adapter: FakeAdapter;
  readonly timers: TimerScheduler;
  readonly inbox: InboxHandle;
  readonly now: () => number;
  afterCommit: (hint: AfterCommitHint) => AfterCommit;
  readonly enqueue: InboxHandle["enqueue"];
  readonly waitIdle: () => Promise<void>;
  readonly recover: () => void;
  readonly stop: () => void;
}

export const createRuntimeHost = (
  options: CreateRuntimeHostOptions,
): RuntimeHost => {
  if (options.seed !== false) {
    seedArtifacts(options.db);
  }
  const inbox = createInbox();
  const now = options.now ?? Date.now;
  const adapter = options.adapter ?? createFakeAdapter();
  const timers = createTimerScheduler(
    inbox,
    now,
    options.useTimeout === undefined ? {} : { useTimeout: options.useTimeout },
  );
  let afterCommit: (hint: AfterCommitHint) => AfterCommit =
    options.afterCommit ?? (() => "continue");
  const ctx: HostContext = {
    db: options.db,
    engine: createEngine({ registry: createOfficialRegistry() }),
    inbox,
    adapter,
    timers,
    now,
    plans: new Map(),
    afterCommit: (hint) => afterCommit(hint),
  };
  inbox.setHandler((message) => handleMessage(ctx, message));
  return {
    db: options.db,
    adapter,
    timers,
    inbox,
    now,
    get afterCommit() {
      return afterCommit;
    },
    set afterCommit(next: (hint: AfterCommitHint) => AfterCommit) {
      afterCommit = next;
    },
    enqueue: inbox.enqueue,
    waitIdle: inbox.waitIdle,
    recover: () => recoverHost(ctx),
    stop: () => timers.stop(),
  };
};
