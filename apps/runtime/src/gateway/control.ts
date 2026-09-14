/**
 * Cloud가 보낸 배포·수동 실행.
 */
import { randomUUID } from "node:crypto";
import {
  desiredDeploymentSchema,
  runStartPayloadSchema,
  type RevisionArtifact,
  type RuntimeEnvelope,
} from "@howling/contracts";
import { createEngine, createOfficialRegistry } from "@howling/core";
import type { RuntimeHost } from "../coordinator/host.js";
import { activateArtifact } from "../deploy/activate.js";
import type { GatewayHandle } from "./client.js";

const engine = createEngine({ registry: createOfficialRegistry() });

export const handleCloudControl = (
  host: RuntimeHost,
  gateway: GatewayHandle,
  envelope: RuntimeEnvelope,
): void => {
  if (envelope.type === "desired.deployment") {
    const payload = desiredDeploymentSchema.parse(envelope.payload);
    const result = activateArtifact(host.db, engine, {
      deploymentId: payload.deploymentId,
      generation: payload.generation,
      artifact: payload.artifact as RevisionArtifact,
    });
    gateway.send("activation.result", {
      deploymentId: payload.deploymentId,
      generation: payload.generation,
      status: result.status,
      ...(result.error ? { error: result.error } : {}),
    });
    return;
  }
  if (envelope.type === "run.start") {
    const payload = runStartPayloadSchema.parse(envelope.payload);
    void host.enqueue({
      kind: "start_run",
      triggerId: randomUUID(),
      artifactId: payload.artifactId,
      input: payload.input as never,
      mode: payload.mode,
      idempotencyKey: payload.idempotencyKey,
    });
  }
};
