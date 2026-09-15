/**
 * 활성 revision의 device.changed를 inbox에 넣는다.
 */
import { randomUUID } from "node:crypto";
import { deviceTriggerConfigSchema, type TriggerBinding } from "@howling/contracts";
import type { RuntimeHost } from "../coordinator/host.js";
import type { HaEvent } from "../ha/client.js";
import { matchDeviceTrigger } from "../ha/match.js";
import { listActiveArtifacts } from "../store/artifacts.js";
import { getDevice } from "./store.js";

export const dispatchDeviceTriggers = (
  host: RuntimeHost,
  event: HaEvent,
  syncing: boolean,
): void => {
  for (const row of listActiveArtifacts(host.db)) {
    const triggers = Array.isArray(row.triggers)
      ? (row.triggers as TriggerBinding[])
      : [];
    for (const trigger of triggers) {
      if (trigger.kind !== "device.changed") {
        continue;
      }
      const parsed = deviceTriggerConfigSchema.safeParse(trigger.config);
      if (!parsed.success) {
        continue;
      }
      const device = getDevice(host.db, parsed.data.deviceId);
      if (!device) {
        continue;
      }
      const matched = matchDeviceTrigger({
        entityId: event.entityId,
        wanted: device.entityId,
        next: event.state,
        syncing,
        inputKey: parsed.data.inputKey,
        ...(event.previous === undefined ? {} : { previous: event.previous }),
      });
      if (!matched) {
        continue;
      }
      void host.enqueue({
        kind: "start_run",
        triggerId: randomUUID(),
        artifactId: row.artifact.id,
        input: matched,
        mode: "auto",
        idempotencyKey: `${row.artifact.id}:${device.id}:${event.state}:${String(host.now())}`,
      });
    }
  }
};
