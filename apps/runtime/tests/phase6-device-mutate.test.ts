import { describe, expect, it } from "vitest";
import type { HaHandle } from "../src/ha/client.js";
import { handleDevicesCreate } from "../src/devices/create.js";
import { handleDevicesDelete, handleDevicesUpdate } from "../src/devices/mutate.js";
import { getDevice, listDevices, summariesOf, upsertDevices } from "../src/devices/store.js";
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

describe("phase 6 device mutate", () => {
  it("renames and deletes a virtual player without calling HA", async () => {
    const { db } = openTestDb();
    const created = await handleDevicesCreate(
      { db, runtimeId: "runtime_dev" },
      { requestId: "req_tv", name: "작업실 TV", product: "apple_tv" },
    );
    const player = created.devices?.find((item) => item.kind === "player");
    expect(player?.deletable).toBe(true);
    const renamed = await handleDevicesUpdate({ db }, { requestId: "req_u", deviceId: player?.id ?? "", name: "서재 TV" });
    expect(renamed.device?.name).toBe("서재 TV");
    expect(JSON.stringify(renamed)).not.toContain("virtual:");
    expect(JSON.stringify(renamed)).not.toContain("entityId");
    const deleted = await handleDevicesDelete({ db }, { requestId: "req_d", deviceId: player?.id ?? "" });
    expect(deleted.deviceId).toBe(player?.id);
    expect(getDevice(db, player?.id ?? "")).toBeUndefined();
    expect(listDevices(db).some((row) => row.name.endsWith("리모컨"))).toBe(true);
    db.close();
  });

  it("renames and deletes a helper, and refuses a house light", async () => {
    const { db } = openTestDb();
    const calls: string[] = [];
    const ha = haOf(async (type, extra) => {
      calls.push(type);
      if (type === "input_boolean/create") {
        return { id: "living_switch" };
      }
      if (type === "get_states") {
        return [
          {
            entity_id: "input_boolean.living_switch",
            state: "off",
            attributes: { friendly_name: "거실 스위치" },
          },
        ];
      }
      if (type === "config/entity_registry/update") {
        expect(extra?.name).toBe("현관 스위치");
        expect(JSON.stringify(extra)).toContain("entity_id");
        return {};
      }
      if (type === "input_boolean/delete") {
        expect(extra?.input_boolean_id).toBe("living_switch");
        expect(extra).not.toHaveProperty("entity_id");
        return {};
      }
      throw new Error(`unexpected ${type}`);
    });
    const created = await handleDevicesCreate(
      { db, runtimeId: "runtime_dev", ha },
      { requestId: "req_sw", name: "거실 스위치", kind: "boolean" },
    );
    const helper = created.device;
    expect(helper?.deletable).toBe(true);
    const renamed = await handleDevicesUpdate(
      { db, ha },
      { requestId: "req_u", deviceId: helper?.id ?? "", name: "현관 스위치" },
    );
    expect(renamed.device?.name).toBe("현관 스위치");
    const deleted = await handleDevicesDelete({ db, ha }, { requestId: "req_d", deviceId: helper?.id ?? "" });
    expect(deleted.deviceId).toBe(helper?.id);
    expect(calls).toContain("config/entity_registry/update");
    expect(calls).toContain("input_boolean/delete");
    upsertDevices(db, "runtime_dev", [
      { entityId: "light.kitchen", state: "on", friendlyName: "부엌 등" },
    ]);
    const light = listDevices(db).find((row) => row.name === "부엌 등");
    expect(light).toBeTruthy();
    const refused = await handleDevicesDelete({ db, ha }, { requestId: "req_l", deviceId: light?.id ?? "" });
    expect(refused.error).toBe("집 기기는 허브에서 빼야 합니다.");
    expect(getDevice(db, light?.id ?? "")?.name).toBe("부엌 등");
    upsertDevices(db, "runtime_dev", [
      {
        entityId: "input_boolean.test_alert",
        state: "off",
        friendlyName: "Test Alert",
        attrs: { editable: false },
      },
    ]);
    const yaml = listDevices(db).find((row) => row.name === "Test Alert");
    expect(yaml).toBeTruthy();
    expect(summariesOf(yaml ? [yaml] : [])[0]?.deletable).toBe(false);
    const yamlHa = haOf(async () => {
      throw new Error("Unable to find input_boolean_id test_alert");
    });
    const yamlDelete = await handleDevicesDelete(
      { db, ha: yamlHa },
      { requestId: "req_y", deviceId: yaml?.id ?? "" },
    );
    expect(yamlDelete.error).toBe("허브 설정에 있는 기기는 여기서 지울 수 없습니다.");
    db.close();
  });
});
