import { describe, expect, it } from "vitest";
import type { HaHandle } from "../src/ha/client.js";
import {
  createHaDevice,
  entityIdFromCreate,
  handleDevicesCreate,
  hintForCreated,
  hintsFromStates,
  publicCreateError,
} from "../src/devices/create.js";
import { listDevices } from "../src/devices/store.js";
import { openTestDb } from "./helpers.js";

const haOf = (request: HaHandle["request"], status: HaHandle["status"] = () => "ready"): HaHandle => ({
  status,
  lastSyncAt: () => null,
  callService: async () => {
    throw new Error("not used");
  },
  request,
  rest: async () => {
    throw new Error("not used");
  },
  stop: () => undefined,
});

describe("phase 6 device create", () => {
  it("reads entity id from the helper create result", () => {
    expect(entityIdFromCreate({ id: "living_switch" }, "input_boolean")).toBe(
      "input_boolean.living_switch",
    );
    expect(entityIdFromCreate({ entity_id: "input_number.power" }, "input_number")).toBe(
      "input_number.power",
    );
    expect(JSON.stringify(entityIdFromCreate({ id: "x" }, "input_boolean"))).not.toContain(
      "entityId",
    );
  });

  it("matches a created helper from get_states without exposing the id", () => {
    const states = hintsFromStates([
      {
        entity_id: "input_boolean.living_switch",
        state: "off",
        attributes: { friendly_name: "거실 스위치" },
      },
    ]);
    const hint = hintForCreated(states, "input_boolean", "거실 스위치");
    expect(hint?.friendlyName).toBe("거실 스위치");
    expect(publicCreateError(new Error("already exists"))).toBe("같은 이름의 기기가 이미 있습니다.");
    expect(publicCreateError(new Error("input_boolean.living_switch already exists"))).toBe(
      "같은 이름의 기기가 이미 있습니다.",
    );
  });

  it("creates a boolean helper and stores a Howling summary", async () => {
    const { db } = openTestDb();
    const device = await createHaDevice({
      ha: haOf(async (type) => {
        if (type === "input_boolean/create") {
          return { id: "living_switch" };
        }
        return [
          {
            entity_id: "input_boolean.living_switch",
            state: "off",
            attributes: { friendly_name: "거실 스위치" },
          },
        ];
      }),
      db,
      runtimeId: "runtime_dev",
      name: "거실 스위치",
      kind: "boolean",
    });
    expect(device.name).toBe("거실 스위치");
    expect(device.kind).toBe("boolean");
    expect(device.actions).toContain("turn_on");
    expect(JSON.stringify(device)).not.toContain("input_boolean");
    expect(listDevices(db)[0]?.entityId).toBe("input_boolean.living_switch");
    db.close();
  });

  it("reuses a local device when HA says it already exists", async () => {
    const { db } = openTestDb();
    await createHaDevice({
      ha: haOf(async () => ({ id: "power" })),
      db,
      runtimeId: "runtime_dev",
      name: "전력",
      kind: "number",
    });
    const reused = await createHaDevice({
      ha: haOf(async () => {
        throw new Error("already exists");
      }),
      db,
      runtimeId: "runtime_dev",
      name: "전력",
      kind: "number",
    });
    expect(reused.name).toBe("전력");
    expect(reused.kind).toBe("number");
    db.close();
  });

  it("rejects create when the hub is not ready", async () => {
    const { db } = openTestDb();
    const result = await handleDevicesCreate(
      { ha: haOf(async () => ({}), () => "connecting"), db, runtimeId: "runtime_dev" },
      { requestId: "req_1", name: "스위치", kind: "boolean" },
    );
    expect(result.error).toBe("허브가 아직 준비되지 않았습니다.");
    expect(result.device).toBeUndefined();
    db.close();
  });
});
