import { describe, expect, it } from "vitest";
import {
  TRIGGER_KINDS,
  deviceReadRequestSchema,
  scheduleTriggerConfigSchema,
  sunTriggerConfigSchema,
  triggerListSchema,
  triggerNeedsHa,
} from "../src/index.js";

describe("time triggers", () => {
  it("defaults sun offset to zero and bounds it to half a day", () => {
    expect(sunTriggerConfigSchema.parse({ event: "sunset" })).toEqual({
      event: "sunset",
      offsetMinutes: 0,
    });
    expect(sunTriggerConfigSchema.parse({ event: "sunrise", offsetMinutes: -30 }).offsetMinutes).toBe(
      -30,
    );
    expect(sunTriggerConfigSchema.safeParse({ event: "noon" }).success).toBe(false);
    expect(sunTriggerConfigSchema.safeParse({ event: "sunset", offsetMinutes: 1000 }).success).toBe(
      false,
    );
  });

  it("accepts HH:mm schedules with optional weekdays", () => {
    expect(scheduleTriggerConfigSchema.parse({ time: "07:30" })).toEqual({ time: "07:30" });
    expect(scheduleTriggerConfigSchema.parse({ time: "23:59", days: [1, 5] }).days).toEqual([1, 5]);
    expect(scheduleTriggerConfigSchema.safeParse({ time: "7:30" }).success).toBe(false);
    expect(scheduleTriggerConfigSchema.safeParse({ time: "24:00" }).success).toBe(false);
    expect(scheduleTriggerConfigSchema.safeParse({ time: "07:30", days: [7] }).success).toBe(false);
  });

  it("knows which kinds need the HA connection", () => {
    expect(TRIGGER_KINDS).toContain("sun");
    expect(TRIGGER_KINDS).toContain("schedule");
    expect(triggerNeedsHa("sun")).toBe(true);
    expect(triggerNeedsHa("device.changed")).toBe(true);
    expect(triggerNeedsHa("schedule")).toBe(false);
  });

  it("validates trigger bindings per kind with field paths", () => {
    const ok = triggerListSchema.safeParse([
      { id: "a", kind: "sun", connectionId: "ha", config: { event: "sunset", offsetMinutes: -30 } },
      { id: "b", kind: "schedule", connectionId: null, config: { time: "07:30" } },
      { id: "c", kind: "device.changed", connectionId: "ha", config: { deviceId: "dev_1", inputKey: "power" } },
    ]);
    expect(ok.success).toBe(true);
    const bad = triggerListSchema.safeParse([
      { id: "a", kind: "sun", connectionId: "ha", config: { event: "noon" } },
      { id: "b", kind: "weather", connectionId: null, config: {} },
    ]);
    expect(bad.success).toBe(false);
    const paths = bad.success ? [] : bad.error.issues.map((issue) => issue.path.join("/"));
    expect(paths).toContain("0/config/event");
    expect(paths.some((path) => path.startsWith("1/kind"))).toBe(true);
  });

  it("reads a device by id only", () => {
    expect(deviceReadRequestSchema.parse({ deviceId: "dev_1" })).toEqual({ deviceId: "dev_1" });
    expect(deviceReadRequestSchema.safeParse({}).success).toBe(false);
  });
});
