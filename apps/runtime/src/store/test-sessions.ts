/**
 * Dry-run 세션. fixture와 고정 artifact를 run에 묶는다.
 */
import type { EffectFixture, JsonValue } from "@howling/core";
import type Database from "better-sqlite3";

export interface TestSession {
  readonly id: string;
  readonly runId: string;
  readonly flowId: string;
  readonly artifactId: string;
  readonly fixtures: readonly EffectFixture[];
  readonly bundleVersion: string;
  readonly initialState: Readonly<Record<string, JsonValue>> | undefined;
}

export const saveTestSession = (db: Database.Database, row: TestSession): void => {
  db.prepare(
    `INSERT INTO test_sessions
       (id, run_id, flow_id, artifact_id, fixtures_json, bundle_version, initial_state_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (run_id) DO UPDATE SET
       fixtures_json = excluded.fixtures_json,
       bundle_version = excluded.bundle_version`,
  ).run(
    row.id,
    row.runId,
    row.flowId,
    row.artifactId,
    JSON.stringify(row.fixtures),
    row.bundleVersion,
    row.initialState ? JSON.stringify(row.initialState) : null,
    new Date().toISOString(),
  );
};

export const addFixture = (
  db: Database.Database,
  runId: string,
  fixture: EffectFixture,
): void => {
  const session = getTestSessionByRun(db, runId);
  if (!session) {
    return;
  }
  saveTestSession(db, {
    ...session,
    fixtures: [...session.fixtures, fixture],
  });
};

export const getTestSessionByRun = (
  db: Database.Database,
  runId: string,
): TestSession | undefined => {
  const row = db.prepare(`SELECT * FROM test_sessions WHERE run_id = ?`).get(runId) as
    | {
        id: string;
        run_id: string;
        flow_id: string;
        artifact_id: string;
        fixtures_json: string;
        bundle_version: string;
        initial_state_json: string | null;
      }
    | undefined;
  if (!row) {
    return undefined;
  }
  return {
    id: row.id,
    runId: row.run_id,
    flowId: row.flow_id,
    artifactId: row.artifact_id,
    fixtures: JSON.parse(row.fixtures_json) as EffectFixture[],
    bundleVersion: row.bundle_version,
    initialState: row.initial_state_json
      ? (JSON.parse(row.initial_state_json) as Record<string, JsonValue>)
      : undefined,
  };
};
