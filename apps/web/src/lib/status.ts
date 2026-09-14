/**
 * 상태 화면이 모으는 조회 결과.
 */
import type {
  CurrentUser,
  HealthStatus,
  ReadyStatus,
  RuntimeStatus,
  SiteSummary,
} from "@howling/contracts";
import {
  fetchHealth,
  fetchMe,
  fetchReady,
  fetchRuntime,
  fetchSites,
} from "./api.js";

export interface StatusSnapshot {
  readonly user: CurrentUser;
  readonly site: SiteSummary;
  readonly health: HealthStatus;
  readonly ready: ReadyStatus;
  readonly runtime: RuntimeStatus;
}

export const loadStatus = async (): Promise<StatusSnapshot> => {
  const [user, sites, health, ready] = await Promise.all([
    fetchMe(),
    fetchSites(),
    fetchHealth(),
    fetchReady(),
  ]);
  const site = sites[0];
  if (!site) {
    throw new Error("연결된 공간이 없습니다.");
  }
  const runtime = await fetchRuntime(site.id);
  return { user, site, health, ready, runtime };
};
