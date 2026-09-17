import { describe, expect, it } from "vitest";
import { handleDevicesAction } from "../src/devices/act.js";
import { handleDevicesCreate } from "../src/devices/create.js";
import { readDeviceValue } from "../src/devices/read.js";
import { listDevices } from "../src/devices/store.js";
import { openTestDb } from "./helpers.js";

const FIELDS = [
  { key: "occupied", type: "boolean" as const, label: "재실" },
  { key: "state", type: "select" as const, options: ["sunny", "cloudy", "rainy"] },
  { key: "temperature", type: "number" as const, label: "온도" },
];

describe("phase 6 virtual multi-field devices", () => {
  it("creates one virtual device with several fields and sets them locally", async () => {
    const { db } = openTestDb();
    const created = await handleDevicesCreate(
      { db, runtimeId: "runtime_dev" },
      { requestId: "req_env", name: "작업실 환경", fields: FIELDS },
    );
    const device = created.devices?.[0];
    expect(created.devices).toHaveLength(1);
    expect(device?.kind).toBe("fields");
    expect(device?.origin).toBe("virtual");
    expect(device?.state).toBe("sunny");
    expect(device?.fields?.map((item) => item.key)).toEqual(["occupied", "state", "temperature"]);
    expect(device?.reading).toContain("재실 꺼짐");
    expect(JSON.stringify(created)).not.toContain("entityId");
    expect(JSON.stringify(created)).not.toContain("__fields");
    expect(listDevices(db)[0]?.entityId.startsWith("virtual:")).toBe(true);

    const acted = await handleDevicesAction(
      { db },
      {
        requestId: "req_set",
        deviceId: device?.id ?? "",
        action: "set_fields",
        data: { occupied: true, state: "cloudy", temperature: 18 },
      },
    );
    expect(acted.device?.state).toBe("cloudy");
    expect(acted.device?.fields?.find((item) => item.key === "occupied")?.value).toBe(true);
    expect(acted.device?.fields?.find((item) => item.key === "temperature")?.value).toBe(18);
    expect(acted.device?.reading).toContain("재실 켜짐");

    const read = readDeviceValue(db, device?.id ?? "") as {
      state: string;
      attrs: Record<string, unknown>;
      fields: { key: string }[];
    };
    expect(read.state).toBe("cloudy");
    expect(read.attrs).toEqual({ occupied: true, state: "cloudy", temperature: 18 });
    expect(read.fields.map((item) => item.key)).toEqual(["occupied", "state", "temperature"]);
    expect(JSON.stringify(read)).not.toContain("__fields");
    db.close();
  });
});
