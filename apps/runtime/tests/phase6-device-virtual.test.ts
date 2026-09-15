import { describe, expect, it } from "vitest";
import type { EffectRequest } from "@howling/core";
import { createDeviceAwareAdapter } from "../src/devices/adapter.js";
import { handleDevicesCreate } from "../src/devices/create.js";
import { listDevices, summariesOf } from "../src/devices/store.js";
import { syncDeviceCatalog } from "../src/devices/store.js";
import { createFakeAdapter } from "../src/effects/fake-adapter.js";
import { createHaAwareAdapter } from "../src/ha/adapter.js";
import type { HaHandle } from "../src/ha/client.js";
import { openTestDb } from "./helpers.js";

const requestOf = (input: unknown): EffectRequest => ({
  id: "eff-1",
  runId: "run-1",
  nodeId: "effect",
  index: 0,
  intent: { kind: "external", adapter: "device", operation: "action", input: input as never },
});

const haOf = (request: HaHandle["request"]): HaHandle => ({
  status: () => "ready",
  lastSyncAt: () => null,
  callService: async () => {
    throw new Error("virtual must not call HA");
  },
  request,
  rest: async () => {
    throw new Error("not used");
  },
  stop: () => undefined,
});

describe("phase 6 virtual composite devices", () => {
  it("creates an Apple TV without calling HA and keeps it after sync", async () => {
    const { db } = openTestDb();
    const created = await handleDevicesCreate(
      {
        db,
        runtimeId: "runtime_dev",
        ha: haOf(async () => {
          throw new Error("virtual must not create helpers");
        }),
      },
      { requestId: "req_tv", name: "작업실 TV", product: "apple_tv" },
    );
    expect(created.devices?.map((item) => item.kind)).toEqual(["player", "remote", "binary"]);
    expect(created.devices?.map((item) => item.name)).toEqual([
      "작업실 TV",
      "작업실 TV 리모컨",
      "작업실 TV 키보드",
    ]);
    expect(JSON.stringify(created)).not.toContain("media_player.");
    expect(JSON.stringify(created)).not.toContain("remote.");
    expect(JSON.stringify(created)).not.toContain("entityId");
    expect(listDevices(db).every((row) => row.origin === "virtual")).toBe(true);
    expect(listDevices(db).every((row) => row.entityId.startsWith("virtual:"))).toBe(true);
    syncDeviceCatalog(db, "runtime_dev", [
      { entityId: "input_number.test_power", state: "1", friendlyName: "Test Power" },
    ]);
    expect(listDevices(db).filter((row) => row.origin === "virtual").every((row) => row.available)).toBe(
      true,
    );
    db.close();
  });

  it("applies play_media locally and does not call HA", async () => {
    const { db } = openTestDb();
    const created = await handleDevicesCreate(
      { db, runtimeId: "runtime_dev" },
      { requestId: "req_play", name: "시험 TV", product: "apple_tv" },
    );
    const player = created.devices?.find((item) => item.kind === "player");
    expect(player).toBeTruthy();
    const events: { entityId: string; state: string }[] = [];
    const adapter = createDeviceAwareAdapter({
      db,
      next: createHaAwareAdapter({
        fake: createFakeAdapter(),
        ha: () => haOf(async () => ({})),
        testHooks: true,
      }),
      onVirtualEvent: (event) => {
        events.push(event);
      },
    });
    const result = await adapter.execute(
      requestOf({
        deviceId: player?.id,
        action: "play_media",
        data: { media_content_id: "app:youtube", media_content_type: "app" },
      }),
    );
    expect(result).toMatchObject({ status: "succeeded" });
    expect(events[0]?.state).toBe("playing");
    expect(events[0]?.entityId.startsWith("virtual:")).toBe(true);
    expect(summariesOf(listDevices(db)).find((item) => item.id === player?.id)?.state).toBe("playing");
    db.close();
  });
});
