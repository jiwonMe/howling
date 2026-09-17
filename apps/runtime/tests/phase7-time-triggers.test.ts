import { describe, expect, it } from "vitest";
import type { WorkflowDefinition } from "@howling/core";
import { upsertArtifact } from "../src/store/artifacts.js";
import { GRACE_MS, scheduleDue, sunDue } from "../src/triggers/due.js";
import { tickTimeTriggers } from "../src/triggers/time.js";
import { createTestHost } from "./helpers.js";

const flow = (id: string): WorkflowDefinition => ({
  schemaVersion: 1,
  id,
  revision: "v1",
  entryNodeId: "input",
  nodes: [{ id: "input", type: "core.input", version: 1, config: {}, inputs: {} }],
  edges: [],
});

const MINUTE = 60_000;
const SUNSET = Date.parse("2026-09-17T09:40:00.000Z");
const sunToday = { nextSetting: new Date(SUNSET).toISOString(), nextRising: null };
const sunTomorrow = {
  nextSetting: new Date(SUNSET + 24 * 60 * MINUTE).toISOString(),
  nextRising: null,
};

const runCount = (host: ReturnType<typeof createTestHost>): number =>
  (host.db.prepare(`SELECT COUNT(*) AS n FROM run_snapshots`).get() as { n: number }).n;

const runInputs = (host: ReturnType<typeof createTestHost>): unknown[] =>
  (host.db.prepare(`SELECT input_json FROM trigger_inbox ORDER BY rowid`).all() as {
    input_json: string;
  }[]).map((row) => JSON.parse(row.input_json) as unknown);

describe("phase 7 time triggers", () => {
  it("computes sunset due with a negative offset", () => {
    const due = sunDue({ event: "sunset", offsetMinutes: -30 }, sunToday);
    expect(due?.due).toBe(SUNSET - 30 * MINUTE);
    expect(due?.input).toMatchObject({ kind: "sun", event: "sunset", offsetMinutes: -30 });
    expect(sunDue({ event: "sunset" }, undefined)).toBeUndefined();
    expect(sunDue({ event: "sunrise" }, sunToday)).toBeUndefined();
  });

  it("rolls a schedule to the next matching day", () => {
    const now = new Date(2026, 8, 17, 8, 0, 0, 0).getTime();
    const today = scheduleDue({ time: "07:30" }, now);
    expect(new Date(today!.due).getDate()).toBe(18);
    const later = scheduleDue({ time: "09:00" }, now);
    expect(new Date(later!.due).getDate()).toBe(17);
    const weekday = new Date(now).getDay();
    const onlyOtherDay = scheduleDue({ time: "09:00", days: [(weekday + 2) % 7] }, now);
    expect(new Date(onlyOtherDay!.due).getDay()).toBe((weekday + 2) % 7);
    expect(scheduleDue({ time: "9:00" }, now)).toBeUndefined();
  });

  it("fires a sunset trigger early once and survives HA rolling to tomorrow", async () => {
    let now = SUNSET - 60 * MINUTE;
    let sun = sunToday;
    const host = createTestHost({ seed: false, now: () => now });
    upsertArtifact(host.db, {
      id: "sunset-early",
      definition: flow("sunset-early"),
      connections: [{ id: "ha", kind: "ha", connectionId: "ha" }],
      triggers: [
        { id: "early", kind: "sun", connectionId: "ha", config: { event: "sunset", offsetMinutes: -30 } },
        { id: "at", kind: "sun", connectionId: "ha", config: { event: "sunset", offsetMinutes: 0 } },
      ],
    });
    const pending = new Map();
    const clock = { host, sun: () => sun, pending };

    expect(tickTimeTriggers(clock)).toBe(0);
    now = SUNSET - 30 * MINUTE + 5_000;
    expect(tickTimeTriggers(clock)).toBe(1);
    expect(tickTimeTriggers(clock)).toBe(0);
    now = SUNSET + 5_000;
    sun = sunTomorrow;
    expect(tickTimeTriggers(clock)).toBe(1);
    now = SUNSET + 20 * MINUTE;
    expect(tickTimeTriggers(clock)).toBe(0);
    await host.waitIdle();
    expect(runCount(host)).toBe(2);
    expect(runInputs(host)).toEqual([
      expect.objectContaining({ trigger: expect.objectContaining({ offsetMinutes: -30 }) }),
      expect.objectContaining({ trigger: expect.objectContaining({ offsetMinutes: 0 }) }),
    ]);
    host.stop();
    host.db.close();
  });

  it("skips a due that is past the grace window and fires a daily schedule once", async () => {
    const base = new Date(2026, 8, 17, 7, 29, 0, 0).getTime();
    let now = base;
    const host = createTestHost({ seed: false, now: () => now });
    upsertArtifact(host.db, {
      id: "morning",
      definition: flow("morning"),
      connections: [],
      triggers: [{ id: "daily", kind: "schedule", connectionId: null, config: { time: "07:30" } }],
    });
    const pending = new Map();
    const clock = { host, sun: () => undefined, pending };
    expect(tickTimeTriggers(clock)).toBe(0);
    now = base + MINUTE + 10_000;
    expect(tickTimeTriggers(clock)).toBe(1);
    now = base + MINUTE + GRACE_MS + 10_000;
    expect(tickTimeTriggers(clock)).toBe(0);
    await host.waitIdle();
    expect(runCount(host)).toBe(1);
    host.stop();
    host.db.close();
  });
});
