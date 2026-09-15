/**
 * Howling 이름·종류로 HA helper를 만든다. entity_id는 여기만 본다.
 */
import {
  isHelperCreate,
  type DeviceCreateRequest,
  type DeviceCreateResult,
  type DeviceSummary,
  type HelperDeviceKind,
} from "@howling/contracts";
import { createVirtualDevices } from "./virtual-create.js";
import type Database from "better-sqlite3";
import type { HaHandle } from "../ha/client.js";
import { listDevices, summariesOf, upsertDevices, type EntityHint } from "./store.js";

const DOMAIN_OF: Readonly<Record<HelperDeviceKind, string>> = {
  number: "input_number",
  boolean: "input_boolean",
};

export const entityIdFromCreate = (result: unknown, domain: string): string | undefined => {
  if (!result || typeof result !== "object") {
    return undefined;
  }
  const row = result as { id?: unknown; entity_id?: unknown };
  if (typeof row.entity_id === "string" && row.entity_id.includes(".")) {
    return row.entity_id;
  }
  if (typeof row.id === "string" && row.id !== "") {
    return row.id.includes(".") ? row.id : `${domain}.${row.id}`;
  }
  return undefined;
};

export const hintsFromStates = (result: unknown): EntityHint[] => {
  if (!Array.isArray(result)) {
    return [];
  }
  return result.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }
    const row = item as {
      entity_id?: string;
      state?: string;
      attributes?: { friendly_name?: string };
    };
    if (!row.entity_id || row.state === undefined) {
      return [];
    }
    return [
      {
        entityId: row.entity_id,
        state: row.state,
        ...(row.attributes?.friendly_name ? { friendlyName: row.attributes.friendly_name } : {}),
      },
    ];
  });
};

export const hintForCreated = (
  states: readonly EntityHint[],
  domain: string,
  name: string,
  entityId?: string,
): EntityHint | undefined => {
  if (entityId) {
    const exact = states.find((item) => item.entityId === entityId);
    if (exact) {
      return exact;
    }
  }
  return states.find(
    (item) => item.entityId.startsWith(`${domain}.`) && item.friendlyName === name,
  );
};

export const publicCreateError = (error: unknown): string => {
  const raw = error instanceof Error ? error.message : "";
  if (raw === "알 수 없는 제품입니다." || raw === "종류 또는 제품이 필요합니다.") {
    return raw;
  }
  if (/already exists|already_exists|duplicate/i.test(raw)) {
    return "같은 이름의 기기가 이미 있습니다.";
  }
  if (/timeout|disconnected|not ready/i.test(raw)) {
    return "허브에 닿지 못했습니다.";
  }
  return "기기를 만들지 못했습니다.";
};

export const createHaDevice = async (input: {
  readonly ha: HaHandle;
  readonly db: Database.Database;
  readonly runtimeId: string;
  readonly name: string;
  readonly kind: HelperDeviceKind;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
}): Promise<DeviceSummary> => {
  const domain = DOMAIN_OF[input.kind];
  const extra =
    input.kind === "number"
      ? {
          min: input.min ?? 0,
          max: input.max ?? 10_000,
          step: input.step ?? 1,
          mode: "box",
        }
      : {};
  let created: unknown;
  try {
    created = await input.ha.request(`${domain}/create`, { name: input.name, ...extra });
  } catch (error) {
    const reused = await reuseExisting(input, domain);
    if (reused) {
      return reused;
    }
    throw new Error(publicCreateError(error));
  }
  const entityId = entityIdFromCreate(created, domain);
  const states = hintsFromStates(await input.ha.request("get_states").catch(() => []));
  const hint =
    hintForCreated(states, domain, input.name, entityId) ??
    (entityId
      ? {
          entityId,
          state: input.kind === "number" ? "0" : "off",
          friendlyName: input.name,
        }
      : undefined);
  if (!hint) {
    throw new Error("기기를 만들지 못했습니다.");
  }
  const rows = upsertDevices(input.db, input.runtimeId, [hint]);
  const summary = summariesOf(rows)[0];
  if (!summary) {
    throw new Error("기기를 만들지 못했습니다.");
  }
  return summary;
};

export const handleDevicesCreate = async (
  input: {
    readonly ha?: HaHandle;
    readonly db: Database.Database;
    readonly runtimeId: string;
  },
  payload: DeviceCreateRequest,
): Promise<DeviceCreateResult> => {
  if (!isHelperCreate(payload)) {
    try {
      const devices = createVirtualDevices(input.db, input.runtimeId, payload);
      return { requestId: payload.requestId, device: devices[0], devices };
    } catch (error) {
      return { requestId: payload.requestId, error: publicCreateError(error) };
    }
  }
  if (!input.ha || input.ha.status() !== "ready") {
    return { requestId: payload.requestId, error: "허브가 아직 준비되지 않았습니다." };
  }
  try {
    const device = await createHaDevice({
      ha: input.ha,
      db: input.db,
      runtimeId: input.runtimeId,
      name: payload.name,
      kind: payload.kind === "number" ? "number" : "boolean",
      ...(payload.min !== undefined ? { min: payload.min } : {}),
      ...(payload.max !== undefined ? { max: payload.max } : {}),
      ...(payload.step !== undefined ? { step: payload.step } : {}),
    });
    return { requestId: payload.requestId, device, devices: [device] };
  } catch (error) {
    return { requestId: payload.requestId, error: publicCreateError(error) };
  }
};

const reuseExisting = async (
  input: {
    readonly ha: HaHandle;
    readonly db: Database.Database;
    readonly runtimeId: string;
    readonly name: string;
    readonly kind: HelperDeviceKind;
  },
  domain: string,
): Promise<DeviceSummary | undefined> => {
  const local = listDevices(input.db).find(
    (row) => row.name === input.name && row.kind === input.kind && row.available,
  );
  if (local) {
    return summariesOf([local])[0];
  }
  const states = hintsFromStates(await input.ha.request("get_states").catch(() => []));
  const hint = hintForCreated(states, domain, input.name);
  if (!hint) {
    return undefined;
  }
  const rows = upsertDevices(input.db, input.runtimeId, [hint]);
  return summariesOf(rows)[0];
};
