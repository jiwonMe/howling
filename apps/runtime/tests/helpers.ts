/**
 * 단계 1 runtime 테스트 헬퍼.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { createRuntimeHost, type CreateRuntimeHostOptions, type RuntimeHost } from "../src/coordinator/host.js";
import type { AfterCommitHint } from "../src/coordinator/context.js";
import { openSqlite } from "../src/db/client.js";
import { migrateSqlite } from "../src/db/migrate.js";
import { listEvents } from "../src/store/events.js";
import { listOutbox } from "../src/store/outbox.js";
import { getRun } from "../src/store/runs.js";
import type { JsonValue } from "@howling/core";

export const migrations = join(
  dirname(fileURLToPath(import.meta.url)),
  "../migrations",
);

export const openTestDb = (path?: string) => {
  const file = path ?? join(mkdtempSync(join(tmpdir(), "howling-runtime-")), "runtime.sqlite");
  const db = openSqlite(file);
  migrateSqlite(db, migrations);
  return { db, path: file };
};

export const createTestHost = (
  options: Omit<CreateRuntimeHostOptions, "db"> & { readonly path?: string; readonly db?: CreateRuntimeHostOptions["db"] } = {},
): RuntimeHost & { readonly path: string } => {
  const opened = options.db
    ? { db: options.db, path: options.path ?? ":memory:" }
    : openTestDb(options.path);
  const { db: _db, path: _path, ...rest } = options;
  const host = createRuntimeHost({
    db: opened.db,
    useTimeout: false,
    ...rest,
  });
  return Object.assign(host, { path: opened.path });
};

export const startDryRun = async (
  host: RuntimeHost,
  input: {
    readonly artifactId: string;
    readonly input?: JsonValue;
    readonly mode?: "auto" | "manual";
    readonly idempotencyKey?: string;
    readonly fixtures?: import("@howling/core").EffectFixture[];
    readonly initialState?: Readonly<Record<string, JsonValue>>;
    readonly runId?: string;
    readonly definition?: unknown;
  },
) => {
  const result = await host.enqueue({
    kind: "start_dry_run",
    triggerId: randomUUID(),
    artifactId: input.artifactId,
    input: input.input ?? null,
    mode: input.mode ?? "auto",
    idempotencyKey: input.idempotencyKey ?? randomUUID(),
    runId: input.runId,
    fixtures: input.fixtures ?? [],
    fixtureBundleVersion: "test",
    initialState: input.initialState,
    ...(input.definition ? { definition: input.definition } : {}),
  });
  await host.waitIdle();
  return result as { triggerId: string; runId: string | null; status: string };
};

export const startRun = async (
  host: RuntimeHost,
  input: {
    readonly artifactId: string;
    readonly input?: JsonValue;
    readonly mode?: "auto" | "manual";
    readonly idempotencyKey?: string;
  },
) => {
  const result = await host.enqueue({
    kind: "start_run",
    triggerId: randomUUID(),
    artifactId: input.artifactId,
    input: input.input ?? null,
    mode: input.mode ?? "auto",
    idempotencyKey: input.idempotencyKey ?? randomUUID(),
  });
  await host.waitIdle();
  return result as { triggerId: string; runId: string | null; status: string };
};

export const haltWhenExternalRequested = (hint: AfterCommitHint) =>
  Object.values(hint.transition.state.effects).some(
    (item) => item.status === "requested" && item.intent.kind === "external",
  )
    ? "halt"
    : "continue";

export const runOf = (host: RuntimeHost, runId: string) => {
  const run = getRun(host.db, runId);
  if (!run) {
    throw new Error(`missing run ${runId}`);
  }
  return run;
};

export const outboxOf = (host: RuntimeHost, runId: string) => listOutbox(host.db, runId);

export const eventsOf = (host: RuntimeHost, runId: string) => listEvents(host.db, runId);

export const applyCount = (host: RuntimeHost): number => {
  const row = host.db
    .prepare(`SELECT COUNT(*) AS n FROM node_state_applies`)
    .get() as { n: number };
  return row.n;
};

export const reopenHost = (
  path: string,
  options: Omit<CreateRuntimeHostOptions, "db"> = {},
): RuntimeHost & { readonly path: string } => {
  const { db } = openTestDb(path);
  return createTestHost({ ...options, db, path, useTimeout: false });
};
