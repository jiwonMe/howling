/**
 * 활성 revision의 HA trigger를 inbox에 넣는다.
 */
import { randomUUID } from "node:crypto";
import type { TriggerBinding } from "@howling/contracts";
import type { RuntimeHost } from "../coordinator/host.js";
import { listActiveArtifacts } from "../store/artifacts.js";
import type { HaEvent } from "./client.js";
import { matchHaNumericTrigger } from "./match.js";

export const dispatchHaTriggers = (
  host: RuntimeHost,
  event: HaEvent,
  syncing: boolean,
): void => {
  for (const row of listActiveArtifacts(host.db)) {
    const triggers = Array.isArray(row.triggers)
      ? (row.triggers as TriggerBinding[])
      : [];
    for (const trigger of triggers) {
      if (trigger.kind !== "ha.state_changed") {
        continue;
      }
      const entityId = String(trigger.config.entityId ?? "");
      const inputKey = String(trigger.config.inputKey ?? "value");
      const matched = matchHaNumericTrigger({
        entityId: event.entityId,
        wanted: entityId,
        next: event.state,
        syncing,
        inputKey,
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
        idempotencyKey: `${row.artifact.id}:${event.entityId}:${event.state}:${String(host.now())}`,
      });
    }
  }
};
