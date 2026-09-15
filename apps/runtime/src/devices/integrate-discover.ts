/**
 * 허브가 이미 찾은 연결만 고른다. flow_id는 클라우드에 안 보낸다.
 */
import { deviceIntegrationOf } from "@howling/contracts";
import type { HaHandle } from "../ha/client.js";

export type DiscoveredFlow = {
  readonly flowId: string;
  readonly handler: string;
  readonly name: string;
};

const WAIT = new Set(["apple_tv"]);
const WAIT_TRIES = 4;
const WAIT_MS = 400;

export const shouldWaitForDiscovery = (handler: string): boolean => WAIT.has(handler);

export const discoveredOf = async (
  ha: HaHandle,
  handler?: string,
): Promise<DiscoveredFlow[]> => {
  const rows = await ha.request("config_entries/flow/progress").catch(() => []);
  const seen = new Map<string, number>();
  const out: DiscoveredFlow[] = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    const item = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
    const id = typeof item.handler === "string" ? item.handler : undefined;
    const flowId = typeof item.flow_id === "string" ? item.flow_id : undefined;
    const catalog = id ? deviceIntegrationOf(id) : undefined;
    if (!id || !flowId || !catalog || (handler && id !== handler)) {
      continue;
    }
    const count = (seen.get(catalog.name) ?? 0) + 1;
    seen.set(catalog.name, count);
    out.push({ flowId, handler: id, name: publicNameOf(item, catalog.name, count) });
  }
  return out;
};

export const waitDiscovered = async (
  ha: HaHandle,
  handler: string,
): Promise<DiscoveredFlow[]> => {
  for (let attempt = 0; attempt < WAIT_TRIES; attempt += 1) {
    const found = await discoveredOf(ha, handler);
    if (found.length > 0) {
      return found;
    }
    if (attempt < WAIT_TRIES - 1) {
      await wait(WAIT_MS);
    }
  }
  return [];
};

const publicNameOf = (item: Record<string, unknown>, fallback: string, count: number): string => {
  const named = titleNameOf(item);
  if (named) {
    return named;
  }
  return count > 1 ? `${fallback} ${String(count)}` : fallback;
};

const titleNameOf = (item: Record<string, unknown>): string | undefined => {
  const context = item.context && typeof item.context === "object" ? (item.context as Record<string, unknown>) : {};
  const placeholders =
    context.title_placeholders && typeof context.title_placeholders === "object"
      ? (context.title_placeholders as Record<string, unknown>)
      : {};
  for (const value of [placeholders.name, context.name, item.title]) {
    if (typeof value !== "string") {
      continue;
    }
    const name = value.trim();
    if (name.length > 0 && name.length <= 64 && !name.includes(".")) {
      return name;
    }
  }
  return undefined;
};

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
