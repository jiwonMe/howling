/**
 * 대시보드 첫 화면용 상태 문구. 값은 있는 것만 쓴다.
 */
import type { RuntimeStatus } from "@howling/contracts";
import type { StatusSnapshot } from "./status.js";

export const haStatus = (runtime: RuntimeStatus): string => {
  if (!("ha" in runtime) || !runtime.ha || typeof runtime.ha !== "object") {
    return "not_configured";
  }
  return (runtime.ha as { status?: string }).status ?? "not_configured";
};

export const siteClaim = (
  data: StatusSnapshot,
): { readonly title: string; readonly detail: string } => {
  const ha = haStatus(data.runtime);
  if (data.ready.status !== "ready") {
    return {
      title: "API가 준비되지 않았습니다",
      detail: `health ${data.health.status}. Database ${data.ready.checks.database ? "ok" : "down"}.`,
    };
  }
  if (!data.runtime.online) {
    return {
      title: "Runtime이 오프라인입니다",
      detail: "연결 화면에서 로컬 runtime을 pairing합니다.",
    };
  }
  if (ha !== "ready") {
    return {
      title: "Home Assistant가 준비되지 않았습니다",
      detail: "로컬 setup에서 URL과 토큰을 넣습니다.",
    };
  }
  return {
    title: "실행할 수 있습니다",
    detail: "Runtime은 online이고 Home Assistant는 ready입니다.",
  };
};

export const runtimeDetail = (runtime: RuntimeStatus): string => {
  const seen = runtime.lastSeenAt ?? "none";
  return `${runtime.runtimeId} · gen ${String(runtime.connectionGeneration)} · last ${seen}`;
};
