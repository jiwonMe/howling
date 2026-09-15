import { describe, expect, it } from "vitest";
import type { HaHandle } from "../src/ha/client.js";
import {
  handleDevicesIntegrate,
  parseIntegrateFields,
  publicIntegrateError,
} from "../src/devices/integrate.js";
import { openTestDb } from "./helpers.js";

const haOf = (rest: HaHandle["rest"], request: HaHandle["request"] = async () => []): HaHandle => ({
  status: () => "ready",
  lastSyncAt: () => null,
  callService: async () => {
    throw new Error("not used");
  },
  request,
  rest,
  stop: () => undefined,
});

describe("phase 6 device integrate", () => {
  it("maps hub fields without entity ids or flow ids", () => {
    const parsed = parseIntegrateFields([
      {
        name: "id",
        options: [
          ["001788fffe123456", "192.168.1.50"],
          ["manual", "Manually add a Hue Bridge"],
        ],
      },
      { name: "entity_id", required: true, type: "string" },
    ]);
    expect(parsed.fields.map((item) => item.label)).toEqual(["기기"]);
    expect(parsed.fields[0]?.options?.some((item) => item.name === "직접 주소 입력")).toBe(true);
    expect(JSON.stringify(parsed.fields)).not.toContain("001788");
    expect(JSON.stringify(parsed.fields)).not.toContain("entity_id");
    expect(publicIntegrateError(new Error("cannot_connect"))).toBe("기기에 닿지 못했습니다.");
  });

  it("rejects unknown integrations and asks for a form", async () => {
    const { db } = openTestDb();
    const unknown = await handleDevicesIntegrate(
      { ha: haOf(async () => ({})), db, runtimeId: "runtime_dev" },
      { requestId: "req_0", integration: "mqtt" as never },
    );
    expect(unknown.status).toBe("error");
    const result = await handleDevicesIntegrate(
      {
        ha: haOf(async () => ({
          type: "form",
          flow_id: "flow-1",
          step_id: "manual",
          data_schema: [{ name: "host", required: true, type: "string" }],
        })),
        db,
        runtimeId: "runtime_dev",
      },
      { requestId: "req_1", integration: "shelly" },
    );
    expect(result.status).toBe("form");
    expect(result.title).toBe("Shelly");
    expect(result.fields?.[0]?.label).toBe("주소");
    expect(result.token).toBeTruthy();
    expect(JSON.stringify(result)).not.toContain("flow-1");
    db.close();
  });

  it("collects new devices after create_entry", async () => {
    const { db } = openTestDb();
    const result = await handleDevicesIntegrate(
      {
        ha: haOf(
          async () => ({ type: "create_entry", title: "Hue Bridge" }),
          async () => [
            {
              entity_id: "light.living_hue",
              state: "on",
              attributes: { friendly_name: "거실 Hue" },
            },
            {
              entity_id: "switch.plug",
              state: "off",
              attributes: { friendly_name: "플러그" },
            },
          ],
        ),
        db,
        runtimeId: "runtime_dev",
      },
      { requestId: "req_2", integration: "hue" },
    );
    expect(result.status).toBe("done");
    expect(result.devices?.map((item) => item.name)).toEqual(["거실 Hue", "플러그"]);
    expect(JSON.stringify(result)).not.toContain("light.living_hue");
    db.close();
  });

  it("lists discovered allowlisted devices without flow ids", async () => {
    const { db } = openTestDb();
    const result = await handleDevicesIntegrate(
      {
        ha: haOf(async () => ({}), async (type) => {
          if (type === "config_entries/flow/progress") {
            return [
              { flow_id: "flow-9", handler: "hue" },
              { flow_id: "flow-8", handler: "mqtt" },
            ];
          }
          return [];
        }),
        db,
        runtimeId: "runtime_dev",
      },
      { requestId: "req_3", list: true },
    );
    expect(result.status).toBe("pick");
    expect(result.options?.[0]?.name).toBe("Philips Hue");
    expect(JSON.stringify(result)).not.toContain("flow-9");
    expect(JSON.stringify(result)).not.toContain("mqtt");
    db.close();
  });

  it("attaches a discovered apple tv without asking for an address", async () => {
    const { db } = openTestDb();
    const rest: HaHandle["rest"] = async (method, path) => {
      if (method === "GET" && String(path).includes("flow-atv")) {
        return {
          type: "form",
          flow_id: "flow-atv",
          step_id: "confirm",
          data_schema: [],
          description_placeholders: { name: "거실", type: "Apple TV" },
        };
      }
      throw new Error("should not start a user flow");
    };
    const result = await handleDevicesIntegrate(
      {
        ha: haOf(rest, async (type) => {
          if (type === "config_entries/flow/progress") {
            return [
              {
                flow_id: "flow-atv",
                handler: "apple_tv",
                context: { title_placeholders: { name: "거실" } },
              },
            ];
          }
          return [];
        }),
        db,
        runtimeId: "runtime_dev",
      },
      { requestId: "req_found", integration: "apple_tv" },
    );
    expect(result.status).toBe("form");
    expect(result.description).toBe("이 기기를 연결할까요? 거실 · Apple TV");
    expect(result.fields ?? []).toEqual([]);
    expect(JSON.stringify(result)).not.toContain("주소");
    expect(JSON.stringify(result)).not.toContain("flow-atv");
    const listed = await handleDevicesIntegrate(
      {
        ha: haOf(async () => ({}), async (type) => {
          if (type === "config_entries/flow/progress") {
            return [
              {
                flow_id: "flow-a",
                handler: "apple_tv",
                context: { title_placeholders: { name: "거실" } },
              },
              {
                flow_id: "flow-b",
                handler: "apple_tv",
                context: { title_placeholders: { name: "침실" } },
              },
            ];
          }
          return [];
        }),
        db,
        runtimeId: "runtime_dev",
      },
      { requestId: "req_pick", integration: "apple_tv" },
    );
    expect(listed.status).toBe("pick");
    expect(listed.options?.map((item) => item.name)).toEqual(["거실", "침실"]);
    expect(JSON.stringify(listed)).not.toContain("flow-a");
    db.close();
  });

  it("walks apple tv pin steps and collects a player", async () => {
    const parsed = parseIntegrateFields([
      { name: "device_input", required: true, type: "string" },
      { name: "pin", required: true, type: "string" },
    ]);
    expect(parsed.fields.map((item) => item.label)).toEqual(["주소 또는 이름", "코드"]);
    expect(parsed.fields[1]?.type).toBe("text");
    expect(publicIntegrateError(new Error("no_devices_found"))).toBe("같은 네트워크에서 찾지 못했습니다.");
    const { db } = openTestDb();
    const pair = await handleDevicesIntegrate(
      {
        ha: haOf(async () => ({
          type: "form",
          flow_id: "flow-atv",
          step_id: "pair_no_pin",
          data_schema: [],
          description_placeholders: { protocol: "AirPlay", pin: 9012 },
        })),
        db,
        runtimeId: "runtime_dev",
      },
      { requestId: "req_atv", integration: "apple_tv" },
    );
    expect(pair.status).toBe("form");
    expect(pair.description).toContain("9012");
    expect(pair.submitLabel).toBe("숫자를 입력했습니다");
    expect(pair.submitLabel).not.toBe("버튼을 눌렀습니다");
    expect(JSON.stringify(pair)).not.toContain("flow-atv");
    const withPin = await handleDevicesIntegrate(
      {
        ha: haOf(async () => ({
          type: "form",
          flow_id: "flow-pin",
          step_id: "pair_with_pin",
          data_schema: [{ name: "pin", required: true, type: "string" }],
          description_placeholders: { protocol: "Companion" },
        })),
        db,
        runtimeId: "runtime_dev",
      },
      { requestId: "req_pin", integration: "apple_tv" },
    );
    expect(withPin.fields?.[0]?.type).toBe("text");
    expect(withPin.description).toContain("Companion");
    const done = await handleDevicesIntegrate(
      {
        ha: haOf(
          async () => ({ type: "create_entry", title: "Apple TV" }),
          async () => [
            {
              entity_id: "media_player.living_room",
              state: "idle",
              attributes: { friendly_name: "거실 Apple TV" },
            },
            {
              entity_id: "remote.living_room",
              state: "on",
              attributes: { friendly_name: "리모컨" },
            },
          ],
        ),
        db,
        runtimeId: "runtime_dev",
      },
      { requestId: "req_done", integration: "apple_tv" },
    );
    expect(done.status).toBe("done");
    expect(done.devices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "거실 Apple TV",
          kind: "player",
        }),
        expect.objectContaining({
          name: "리모컨",
          kind: "remote",
        }),
      ]),
    );
    expect(done.devices?.find((item) => item.kind === "player")?.actions).toContain("play_media");
    expect(JSON.stringify(done)).not.toContain("media_player.");
    expect(JSON.stringify(done)).not.toContain("entity_id");
    db.close();
  });
});
