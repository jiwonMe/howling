/**
 * 허브 config flow를 Howling 연결로 대행한다. flow_id·entity_id는 클라우드에 없다.
 */
import { randomUUID } from "node:crypto";
import {
  deviceIntegrationOf,
  type DeviceIntegrateRequest,
  type DeviceIntegrateResult,
  type DeviceSummary,
} from "@howling/contracts";
import type Database from "better-sqlite3";
import type { HaHandle } from "../ha/client.js";
import { hintsFromStates } from "./create.js";
import {
  decodeIntegrateValues,
  descriptionOf,
  flowErrorOf,
  parseIntegrateFields,
  parseMenuFields,
  publicIntegrateError,
  submitLabelOf,
  type FieldTypes,
  type OptionMaps,
} from "./integrate-fields.js";
import { discoveredOf, shouldWaitForDiscovery, waitDiscovered } from "./integrate-discover.js";
import { listDevices, summariesOf, upsertDevices } from "./store.js";

type PendingFlow = {
  readonly flowId: string;
  readonly handler: string;
  optionMaps: OptionMaps;
  types: FieldTypes;
};

const pending = new Map<string, PendingFlow>();

export { descriptionOf, parseIntegrateFields, publicIntegrateError } from "./integrate-fields.js";

export const handleDevicesIntegrate = async (
  input: {
    readonly ha?: HaHandle;
    readonly db: Database.Database;
    readonly runtimeId: string;
  },
  payload: DeviceIntegrateRequest,
): Promise<DeviceIntegrateResult> => {
  if (!input.ha || input.ha.status() !== "ready") {
    return { requestId: payload.requestId, status: "error", error: "허브가 아직 준비되지 않았습니다." };
  }
  try {
    if (payload.list === true) {
      return listDiscovered(input.ha, payload.requestId);
    }
    if (payload.token) {
      return continueFlow(input, payload);
    }
    if (!payload.integration || !deviceIntegrationOf(payload.integration)) {
      return { requestId: payload.requestId, status: "error", error: "연결할 기기를 고르세요." };
    }
    const attached = await attachDiscovered(input, payload.requestId, payload.integration);
    if (attached) {
      return attached;
    }
    const started = await input.ha.rest("POST", "/api/config/config_entries/flow", {
      handler: payload.integration,
      show_advanced_options: false,
    });
    return mapFlow(input, payload.requestId, started, payload.integration);
  } catch (error) {
    return { requestId: payload.requestId, status: "error", error: publicIntegrateError(error) };
  }
};

const listDiscovered = async (ha: HaHandle, requestId: string): Promise<DeviceIntegrateResult> => ({
  requestId,
  status: "pick",
  options: (await discoveredOf(ha)).map(storePending),
});

const attachDiscovered = async (
  input: {
    readonly ha?: HaHandle;
    readonly db: Database.Database;
    readonly runtimeId: string;
  },
  requestId: string,
  handler: string,
): Promise<DeviceIntegrateResult | undefined> => {
  const ha = input.ha;
  if (!ha) {
    return undefined;
  }
  let found = await discoveredOf(ha, handler);
  if (found.length === 0 && shouldWaitForDiscovery(handler)) {
    found = await waitDiscovered(ha, handler);
  }
  if (found.length === 0) {
    return undefined;
  }
  if (found.length > 1) {
    return { requestId, status: "pick", options: found.map(storePending) };
  }
  const token = storePending(found[0]!).key;
  const current = await ha.rest("GET", `/api/config/config_entries/flow/${found[0]!.flowId}`);
  return mapFlow(input, requestId, current, handler, token);
};

const storePending = (item: { readonly flowId: string; readonly handler: string; readonly name: string }) => {
  const token = randomUUID();
  pending.set(token, {
    flowId: item.flowId,
    handler: item.handler,
    optionMaps: new Map(),
    types: new Map(),
  });
  return { key: token, name: item.name };
};

const continueFlow = async (
  input: {
    readonly ha?: HaHandle;
    readonly db: Database.Database;
    readonly runtimeId: string;
  },
  payload: DeviceIntegrateRequest,
): Promise<DeviceIntegrateResult> => {
  const ha = input.ha;
  const current = payload.token ? pending.get(payload.token) : undefined;
  if (!ha || !current || !payload.token) {
    return { requestId: payload.requestId, status: "error", error: "연결을 다시 시작해 주세요." };
  }
  const result =
    payload.values === undefined
      ? await ha.rest("GET", `/api/config/config_entries/flow/${current.flowId}`)
      : await ha.rest(
          "POST",
          `/api/config/config_entries/flow/${current.flowId}`,
          decodeIntegrateValues(payload.values, current.optionMaps, current.types),
        );
  return mapFlow(input, payload.requestId, result, current.handler, payload.token);
};

const mapFlow = async (
  input: {
    readonly ha?: HaHandle;
    readonly db: Database.Database;
    readonly runtimeId: string;
  },
  requestId: string,
  result: unknown,
  handler: string,
  token?: string,
): Promise<DeviceIntegrateResult> => {
  const flow = asFlow(result);
  if (flow.type === "abort") {
    if (token) {
      pending.delete(token);
    }
    return { requestId, status: "error", error: publicIntegrateError(new Error(flow.reason ?? "abort")) };
  }
  if (flow.type === "create_entry") {
    if (token) {
      pending.delete(token);
    }
    return collectDevices(input, requestId);
  }
  if (flow.type === "external") {
    if (token) {
      pending.delete(token);
    }
    return { requestId, status: "error", error: publicIntegrateError(new Error("external")) };
  }
  if (flow.type === "menu") {
    if (!flow.flow_id) {
      return { requestId, status: "error", error: "기기를 연결하지 못했습니다." };
    }
    return storeForm(requestId, handler, flow, parseMenuFields(flow.menu_options), token);
  }
  if ((flow.type !== "form" && flow.type !== "progress") || !flow.flow_id) {
    return { requestId, status: "error", error: "기기를 연결하지 못했습니다." };
  }
  const parsed = parseIntegrateFields(flow.data_schema);
  return storeForm(requestId, handler, flow, parsed, token);
};

const storeForm = (
  requestId: string,
  handler: string,
  flow: ReturnType<typeof asFlow>,
  parsed: ReturnType<typeof parseIntegrateFields>,
  token?: string,
): DeviceIntegrateResult => {
  const next = token ?? randomUUID();
  pending.set(next, {
    flowId: flow.flow_id ?? "",
    handler,
    optionMaps: parsed.optionMaps,
    types: parsed.types,
  });
  const title = deviceIntegrationOf(handler)?.name ?? "기기";
  const error = flowErrorOf(flow.errors);
  return {
    requestId,
    status: "form",
    token: next,
    title,
    description: descriptionOf(flow.step_id ?? "", parsed.fields.length, flow.placeholders, handler),
    submitLabel: submitLabelOf(flow.step_id ?? "", parsed.fields.length),
    ...(parsed.fields.length > 0 ? { fields: parsed.fields } : {}),
    ...(error ? { error } : {}),
  };
};

const collectDevices = async (
  input: {
    readonly ha?: HaHandle;
    readonly db: Database.Database;
    readonly runtimeId: string;
  },
  requestId: string,
): Promise<DeviceIntegrateResult> => {
  const before = new Set(listDevices(input.db).map((row) => row.id));
  if (input.ha) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const states = hintsFromStates(await input.ha.request("get_states").catch(() => []));
      upsertDevices(input.db, input.runtimeId, states);
      const created = addedOf(input.db, before);
      if (created.length > 0) {
        return { requestId, status: "done", devices: created };
      }
      await wait(400);
    }
  }
  return { requestId, status: "done", devices: addedOf(input.db, before) };
};

const addedOf = (db: Database.Database, before: ReadonlySet<string>): DeviceSummary[] =>
  summariesOf(listDevices(db).filter((row) => row.available && !before.has(row.id)));

const asFlow = (result: unknown) => {
  const row = result && typeof result === "object" ? (result as Record<string, unknown>) : {};
  return {
    type: typeof row.type === "string" ? row.type : "",
    flow_id: typeof row.flow_id === "string" ? row.flow_id : undefined,
    step_id: typeof row.step_id === "string" ? row.step_id : undefined,
    reason: typeof row.reason === "string" ? row.reason : undefined,
    data_schema: row.data_schema,
    menu_options: row.menu_options,
    errors: row.errors,
    placeholders: placeholdersOf(row.description_placeholders),
  };
};

const placeholdersOf = (raw: unknown): Record<string, string> => {
  if (!raw || typeof raw !== "object") {
    return {};
  }
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const text =
      typeof value === "number" && Number.isFinite(value)
        ? String(value)
        : typeof value === "string"
          ? value
          : undefined;
    if (text && text.length <= 64 && !text.includes(".")) {
      out[key] = text;
    }
  }
  return out;
};

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
