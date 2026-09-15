/**
 * 로컬 전송·관측 정책. 재연결 때 최신 값을 먼저 적용한다.
 */
import {
  DEFAULT_DATA_POLICY,
  type ObservationSpec,
  type SiteDataPolicy,
} from "@howling/contracts";
import type Database from "better-sqlite3";

const ROW = "site";

export const getLocalPolicy = (
  db: Database.Database,
): {
  readonly policy: SiteDataPolicy;
  readonly captureRaw: boolean;
  readonly rawEnabledAt: string | null;
  readonly observations: ObservationSpec;
} => {
  const row = db
    .prepare(
      `SELECT policy_json, capture_raw, raw_enabled_at, observations_json
       FROM local_data_policy WHERE id = ?`,
    )
    .get(ROW) as
    | {
        policy_json: string;
        capture_raw: number;
        raw_enabled_at: string | null;
        observations_json: string;
      }
    | undefined;
  if (!row) {
    return {
      policy: { ...DEFAULT_DATA_POLICY },
      captureRaw: false,
      rawEnabledAt: null,
      observations: { fields: [] },
    };
  }
  return {
    policy: JSON.parse(row.policy_json) as SiteDataPolicy,
    captureRaw: row.capture_raw === 1,
    rawEnabledAt: row.raw_enabled_at,
    observations: JSON.parse(row.observations_json) as ObservationSpec,
  };
};

export const putLocalPolicy = (
  db: Database.Database,
  input: {
    readonly policy: SiteDataPolicy;
    readonly captureRaw: boolean;
    readonly observations: ObservationSpec;
  },
): { readonly turnedOff: boolean; readonly turnedOn: boolean } => {
  const previous = getLocalPolicy(db);
  const turnedOff = previous.captureRaw && !input.captureRaw;
  const turnedOn = !previous.captureRaw && input.captureRaw;
  const rawEnabledAt = turnedOff
    ? null
    : turnedOn
      ? new Date().toISOString()
      : previous.rawEnabledAt;
  db.prepare(
    `INSERT INTO local_data_policy
       (id, policy_json, capture_raw, raw_enabled_at, observations_json)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET
       policy_json = excluded.policy_json,
       capture_raw = excluded.capture_raw,
       raw_enabled_at = excluded.raw_enabled_at,
       observations_json = excluded.observations_json`,
  ).run(
    ROW,
    JSON.stringify(input.policy),
    input.captureRaw ? 1 : 0,
    rawEnabledAt,
    JSON.stringify(input.observations),
  );
  return { turnedOff, turnedOn };
};
