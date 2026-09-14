/**
 * Runtime가 올린 배포·실행·연결 상태.
 */
import {
  activationResultSchema,
  connectionsSnapshotSchema,
  runSummaryPayloadSchema,
  type RuntimeEnvelope,
} from "@howling/contracts";
import type pg from "pg";
import { setDeploymentStatus } from "../flows/store.js";
import { upsertRunSummary } from "../flows/runs.js";

export const handleRuntimeControl = async (
  pool: pg.Pool,
  envelope: RuntimeEnvelope,
): Promise<void> => {
  if (envelope.type === "activation.result") {
    const payload = activationResultSchema.parse(envelope.payload);
    await setDeploymentStatus(
      pool,
      payload.deploymentId,
      payload.status === "active" ? "active" : "failed",
      payload.error,
    );
    return;
  }
  if (envelope.type === "run.summary") {
    const payload = runSummaryPayloadSchema.parse(envelope.payload);
    await upsertRunSummary(pool, envelope.siteId, payload);
    return;
  }
  if (envelope.type === "connections.snapshot") {
    const payload = connectionsSnapshotSchema.parse(envelope.payload);
    await pool.query(
      `UPDATE runtime_registrations
       SET capabilities = COALESCE(capabilities, '{}'::jsonb) || $2::jsonb
       WHERE runtime_id = $1`,
      [envelope.runtimeId, JSON.stringify({ ha: payload.ha, connectors: ["homeassistant"] })],
    );
  }
};
