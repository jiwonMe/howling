/**
 * Runtime·허브 상태 라벨. 값은 있는 것만 쓴다.
 */
import type { RuntimeStatus } from "@howling/contracts";
import type { StatusSnapshot } from "./status.js";

export const haStatus = (runtime: RuntimeStatus): string => {
  if (!("ha" in runtime) || !runtime.ha || typeof runtime.ha !== "object") {
    return "not_configured";
  }
  return (runtime.ha as { status?: string }).status ?? "not_configured";
};

export const mcpStatus = (runtime: RuntimeStatus): string => runtime.mcp?.status ?? "not_configured";

export const mcpToolCount = (runtime: RuntimeStatus): number =>
  runtime.mcp?.servers.reduce((sum, server) => sum + server.tools.length, 0) ?? 0;

export const runtimeDetail = (runtime: RuntimeStatus): string => {
  const seen = runtime.lastSeenAt ?? "none";
  return `${runtime.runtimeId} · gen ${String(runtime.connectionGeneration)} · last ${seen}`;
};

export interface RailState {
  readonly key: "api" | "runtime" | "ha";
  readonly label: string;
  readonly value: string;
  readonly ok: boolean;
}

export const railStatesOf = (data: StatusSnapshot): readonly RailState[] => {
  const ha = haStatus(data.runtime);
  return [
    {
      key: "api",
      label: "API",
      value: data.ready.status === "ready" ? "ready" : "not_ready",
      ok: data.ready.status === "ready",
    },
    {
      key: "runtime",
      label: "Runtime",
      value: data.runtime.online ? "online" : "offline",
      ok: data.runtime.online,
    },
    {
      key: "ha",
      label: "허브",
      value: ha,
      ok: ha === "ready",
    },
  ];
};
