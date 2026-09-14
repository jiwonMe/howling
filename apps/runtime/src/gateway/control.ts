/**
 * Cloud가 보낸 배포·실행.
 */
import { randomUUID } from "node:crypto";
import {
  desiredDeploymentSchema,
  effectFixtureSchema,
  runCommandPayloadSchema,
  runStartPayloadSchema,
  summaryAckSchema,
  type RevisionArtifact,
  type RuntimeEnvelope,
} from "@howling/contracts";
import type { EffectFixture, JsonValue } from "@howling/core";
import { createEngine, createOfficialRegistry } from "@howling/core";
import type { RuntimeHost } from "../coordinator/host.js";
import { activateArtifact } from "../deploy/activate.js";
import { mergeFixtures } from "../coordinator/dry-fixtures.js";
import { ackSummary } from "../store/summary-journal.js";
import { sha256Json } from "../store/hash.js";
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
      ...(payload.rollback !== undefined ? { rollback: payload.rollback } : {}),
      ...(payload.stateEpoch !== undefined ? { stateEpoch: payload.stateEpoch } : {}),
    });
    gateway.send("activation.result", {
      deploymentId: payload.deploymentId,
      generation: payload.generation,
      status: result.status,
      ...(result.error ? { error: result.error } : {}),
    });
    return;
  }
  if (envelope.type === "summary.ack") {
    ackSummary(host.db, summaryAckSchema.parse(envelope.payload).syncSeq);
    return;
  }
  if (envelope.type === "run.start") {
    startFromCloud(host, runStartPayloadSchema.parse(envelope.payload));
    return;
  }
  if (envelope.type === "run.step") {
    commandFromCloud(host, envelope, runCommandPayloadSchema.parse(envelope.payload));
  }
};

const startFromCloud = (
  host: RuntimeHost,
  payload: ReturnType<typeof runStartPayloadSchema.parse>,
): void => {
  const fixtures = (payload.fixtures ?? [])
    .map((item) => effectFixtureSchema.safeParse(item))
    .flatMap((item) => (item.success ? [item.data as EffectFixture] : []));
  if (payload.runMode === "dryRun") {
    const artifact = payload.artifact as RevisionArtifact | undefined;
    const merged = mergeFixtures(fixtures, artifact?.definition);
    void host.enqueue({
      kind: "start_dry_run",
      triggerId: randomUUID(),
      artifactId: payload.artifactId,
      input: payload.input as never,
      mode: payload.mode,
      idempotencyKey: payload.idempotencyKey,
      fixtures: merged,
      fixtureBundleVersion: payload.fixtureBundleVersion ?? sha256Json(merged),
      ...(payload.runId ? { runId: payload.runId } : {}),
      ...(payload.initialState
        ? { initialState: payload.initialState as Readonly<Record<string, JsonValue>> }
        : {}),
      ...(payload.testSessionId ? { testSessionId: payload.testSessionId } : {}),
      ...(artifact?.definition ? { definition: artifact.definition } : {}),
      ...(artifact?.triggers ? { triggers: artifact.triggers } : {}),
      ...(artifact?.connections ? { connections: artifact.connections } : {}),
    });
    return;
  }
  void host.enqueue({
    kind: "start_run",
    triggerId: randomUUID(),
    artifactId: payload.artifactId,
    input: payload.input as never,
    mode: payload.mode,
    idempotencyKey: payload.idempotencyKey,
  });
};

const commandFromCloud = (
  host: RuntimeHost,
  envelope: RuntimeEnvelope,
  payload: ReturnType<typeof runCommandPayloadSchema.parse>,
): void => {
  const expiresAt = payload.expiresAt ?? envelope.expiresAt;
  if (expiresAt && Date.parse(expiresAt) <= Date.now()) {
    return;
  }
  if (payload.type === "fixture") {
    const response = effectFixtureSchema.shape.response.safeParse(payload.response);
    if (!response.success || !payload.effectId) {
      return;
    }
    void host.enqueue({
      kind: "fixture",
      runId: payload.runId,
      commandId: payload.commandId,
      effectId: payload.effectId,
      response: response.data as never,
    });
    return;
  }
  void host.enqueue({
    kind: payload.type,
    runId: payload.runId,
    commandId: payload.commandId,
  });
};
