/**
 * commit된 이벤트만 읽는다. coordinator를 멈추지 않는다.
 */
import type { ObserveSample } from "@howling/contracts";
import type { ExecutionEvent } from "@howling/core";
import type Database from "better-sqlite3";
import type { GatewayHandle } from "../gateway/client.js";
import { getLocalPolicy } from "../data/policy.js";
import { asNumber, readPointer } from "../data/pointer.js";
import { listEvents } from "../store/events.js";
import { appendJournal, listUnacked } from "../store/sync-journal.js";

export const tickObserver = (db: Database.Database, gateway?: GatewayHandle): void => {
  try {
    const samples = collectSamples(db);
    if (samples.length === 0) {
      return;
    }
    insertSamples(db, samples);
    const batch = {
      runtimeId: gateway?.runtimeId() ?? "runtime_dev",
      stream: "observe" as const,
      items: samples,
      tombstone: false,
    };
    const syncSeq = appendJournal(db, "observe", samples[0]?.runId ?? "observe", batch);
    gateway?.send("observe.batch", { ...batch, syncSeq });
  } catch {
    // observer 지연이 실행을 막으면 안 된다.
  }
};

export const flushUnackedObserve = (db: Database.Database, gateway: GatewayHandle): void => {
  for (const row of listUnacked(db, "observe")) {
    const item = row.item && typeof row.item === "object" ? (row.item as Record<string, unknown>) : {};
    gateway.send("observe.batch", {
      runtimeId: gateway.runtimeId() ?? "runtime_dev",
      stream: "observe",
      syncSeq: row.syncSeq,
      items: Array.isArray(item.items) ? item.items : [],
      tombstone: row.tombstone || item.tombstone === true,
    });
  }
};

const collectSamples = (db: Database.Database): ObserveSample[] => {
  const fields = getLocalPolicy(db).observations.fields;
  if (fields.length === 0) {
    return [];
  }
  const runs = db.prepare(`SELECT run_id, flow_id FROM run_snapshots`).all() as {
    run_id: string;
    flow_id: string;
  }[];
  const samples: ObserveSample[] = [];
  const now = new Date().toISOString();
  for (const run of runs) {
    const last = lastSeq(db, run.run_id);
    const events = listEvents(db, run.run_id).filter((event) => event.sequence > last);
    for (const event of events) {
      samples.push(...samplesOf(db, event, run.flow_id, now));
      setSeq(db, run.run_id, event.sequence);
    }
  }
  return samples;
};

const samplesOf = (
  db: Database.Database,
  event: ExecutionEvent,
  flowId: string,
  ts: string,
): ObserveSample[] => {
  const fields = getLocalPolicy(db).observations.fields;
  const source =
    event.type === "node.completed" || event.type === "node.started"
      ? (event.outputs ?? event.inputs)
      : event.type === "node.stateUpdated"
        ? event.nextState
        : undefined;
  if (!source) {
    return [];
  }
  const out: ObserveSample[] = [];
  for (const field of fields) {
    if (field.flowId !== flowId || !("nodeId" in event) || event.nodeId !== field.nodeId) {
      continue;
    }
    if (field.sampleIntervalMs && tooSoon(db, field.id, field.sampleIntervalMs, ts)) {
      continue;
    }
    const value = asNumber(readPointer(source, field.pointer));
    if (value === undefined) {
      continue;
    }
    out.push({
      fieldId: field.id,
      ts,
      value,
      kind: "sample",
      runId: event.runId,
      nodeId: event.nodeId,
    });
  }
  return out;
};

const lastSeq = (db: Database.Database, runId: string): number => {
  const row = db
    .prepare(`SELECT last_sequence FROM observer_progress WHERE run_id = ?`)
    .get(runId) as { last_sequence: number } | undefined;
  return row?.last_sequence ?? 0;
};

const setSeq = (db: Database.Database, runId: string, sequence: number): void => {
  db.prepare(
    `INSERT INTO observer_progress (run_id, last_sequence) VALUES (?, ?)
     ON CONFLICT (run_id) DO UPDATE SET last_sequence = excluded.last_sequence`,
  ).run(runId, sequence);
};

const insertSamples = (db: Database.Database, samples: readonly ObserveSample[]): void => {
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO observation_samples
       (field_id, ts, value, kind, run_id, node_id) VALUES (?, ?, ?, ?, ?, ?)`,
  );
  for (const sample of samples) {
    stmt.run(sample.fieldId, sample.ts, sample.value, sample.kind, sample.runId ?? null, sample.nodeId ?? null);
  }
};

const tooSoon = (db: Database.Database, fieldId: string, intervalMs: number, ts: string): boolean => {
  const row = db
    .prepare(`SELECT ts FROM observation_samples WHERE field_id = ? ORDER BY ts DESC LIMIT 1`)
    .get(fieldId) as { ts: string } | undefined;
  if (!row) {
    return false;
  }
  return Date.parse(ts) - Date.parse(row.ts) < intervalMs;
};
