/**
 * runtime에 최신 보관·관측 정책을 먼저 보낸다.
 */
import type pg from "pg";
import { sendToRuntime } from "../runtime/hub.js";
import { getDataPolicy, getObservations } from "./store.js";

export const pushDesiredData = async (pool: pg.Pool, siteId: string): Promise<boolean> => {
  const policy = await getDataPolicy(pool, siteId);
  const observations = await getObservations(pool, siteId);
  return sendToRuntime(siteId, "desired.data", {
    captureRaw: policy.defaultCaptureRaw,
    policy,
    observations,
  });
};
