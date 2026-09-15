/**
 * Cloud가 보낸 배포·실행.
 */
import { randomUUID } from "node:crypto";
import {
  desiredDataSchema,
  desiredDeploymentSchema,
  detailRequestSchema,
  deviceActionInvokeSchema,
  deviceCreateRequestSchema,
  deviceDeleteRequestSchema,
  deviceIntegrateRequestSchema,
  deviceUpdateRequestSchema,
  effectFixtureSchema,
  oauthCodePayloadSchema,
  runCommandPayloadSchema,
  runStartPayloadSchema,
  summaryAckSchema,
  type DeviceActionInvoke,
  type DeviceActionResult,
  type DeviceCreateRequest,
  type DeviceCreateResult,
  type DeviceDeleteRequest,
  type DeviceDeleteResult,
  type DeviceIntegrateRequest,
  type DeviceIntegrateResult,
  type DeviceUpdateRequest,
  type DeviceUpdateResult,
  type RevisionArtifact,
  type RuntimeEnvelope,
} from "@howling/contracts";
import type { EffectFixture, JsonValue } from "@howling/core";
import { createEngine, createOfficialRegistry } from "@howling/core";
import type { RuntimeHost } from "../coordinator/host.js";
import { activateArtifact } from "../deploy/activate.js";
import { mergeFixtures } from "../coordinator/dry-fixtures.js";
import { answerDetail } from "../data/detail.js";
import { applyCaptureGate } from "../data/publish-raw.js";
import { putLocalPolicy } from "../data/policy.js";
import { retainLocal } from "../data/retain.js";
import { ackJournal } from "../store/sync-journal.js";
import { sha256Json } from "../store/hash.js";
import type { GatewayHandle } from "./client.js";

const engine = createEngine({ registry: createOfficialRegistry() });

export type CloudControlExtras = {
  readonly onOauthCode?: (state: string, code: string) => void;
  readonly onDevicesCreate?: (payload: DeviceCreateRequest) => Promise<DeviceCreateResult>;
  readonly onDevicesIntegrate?: (payload: DeviceIntegrateRequest) => Promise<DeviceIntegrateResult>;
  readonly onDevicesAction?: (payload: DeviceActionInvoke) => Promise<DeviceActionResult>;
  readonly onDevicesUpdate?: (payload: DeviceUpdateRequest) => Promise<DeviceUpdateResult>;
  readonly onDevicesDelete?: (payload: DeviceDeleteRequest) => Promise<DeviceDeleteResult>;
};

export const handleCloudControl = (
  host: RuntimeHost,
  gateway: GatewayHandle,
  envelope: RuntimeEnvelope,
  extras?: CloudControlExtras,
): void => {
  try {
    dispatchCloudControl(host, gateway, envelope, extras);
  } catch {
    // 한 제어 실패가 소켓 핸들러를 죽이지 않는다.
  }
};

const dispatchCloudControl = (
  host: RuntimeHost,
  gateway: GatewayHandle,
  envelope: RuntimeEnvelope,
  extras?: CloudControlExtras,
): void => {
  if (envelope.type === "devices.integrate") {
    const payload = deviceIntegrateRequestSchema.parse(envelope.payload);
    void Promise.resolve(extras?.onDevicesIntegrate?.(payload))
      .then((result) => {
        gateway.send(
          "devices.integrated",
          result ?? { requestId: payload.requestId, status: "error", error: "runtime cannot integrate" },
        );
      })
      .catch(() => {
        gateway.send("devices.integrated", {
          requestId: payload.requestId,
          status: "error",
          error: "기기를 연결하지 못했습니다.",
        });
      });
    return;
  }
  if (envelope.type === "devices.action") {
    const payload = deviceActionInvokeSchema.parse(envelope.payload);
    void Promise.resolve(extras?.onDevicesAction?.(payload))
      .then((result) => {
        gateway.send(
          "devices.acted",
          result ?? { requestId: payload.requestId, error: "runtime cannot act" },
        );
      })
      .catch(() => {
        gateway.send("devices.acted", {
          requestId: payload.requestId,
          error: "기기를 바꾸지 못했습니다.",
        });
      });
    return;
  }
  if (envelope.type === "devices.update") {
    const payload = deviceUpdateRequestSchema.parse(envelope.payload);
    void Promise.resolve(extras?.onDevicesUpdate?.(payload))
      .then((result) => {
        gateway.send(
          "devices.updated",
          result ?? { requestId: payload.requestId, error: "runtime cannot update devices" },
        );
      })
      .catch(() => {
        gateway.send("devices.updated", {
          requestId: payload.requestId,
          error: "이름을 바꾸지 못했습니다.",
        });
      });
    return;
  }
  if (envelope.type === "devices.delete") {
    const payload = deviceDeleteRequestSchema.parse(envelope.payload);
    void Promise.resolve(extras?.onDevicesDelete?.(payload))
      .then((result) => {
        gateway.send(
          "devices.deleted",
          result ?? { requestId: payload.requestId, error: "runtime cannot delete devices" },
        );
      })
      .catch(() => {
        gateway.send("devices.deleted", {
          requestId: payload.requestId,
          error: "기기를 지우지 못했습니다.",
        });
      });
    return;
  }
  if (envelope.type === "devices.create") {
    const payload = deviceCreateRequestSchema.parse(envelope.payload);
    void Promise.resolve(extras?.onDevicesCreate?.(payload))
      .then((result) => {
        gateway.send(
          "devices.created",
          result ?? { requestId: payload.requestId, error: "runtime cannot create devices" },
        );
      })
      .catch(() => {
        gateway.send("devices.created", {
          requestId: payload.requestId,
          error: "기기를 만들지 못했습니다.",
        });
      });
    return;
  }
  if (envelope.type === "oauth.code") {
    const payload = oauthCodePayloadSchema.parse(envelope.payload);
    extras?.onOauthCode?.(payload.state, payload.code);
    return;
  }
  if (envelope.type === "desired.deployment") {
    const payload = desiredDeploymentSchema.parse(envelope.payload);
    const result = activateArtifact(host.db, engine, {
      deploymentId: payload.deploymentId,
      generation: payload.generation,
      artifact: payload.artifact as RevisionArtifact,
      ...(payload.rollback !== undefined ? { rollback: payload.rollback } : {}),
      ...(payload.deactivate !== undefined ? { deactivate: payload.deactivate } : {}),
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
  if (envelope.type === "desired.data") {
    const payload = desiredDataSchema.parse(envelope.payload);
    const change = putLocalPolicy(host.db, {
      policy: payload.policy,
      captureRaw: payload.captureRaw,
      observations: payload.observations,
    });
    if (change.turnedOff) {
      applyCaptureGate(host.db);
    }
    retainLocal(host.db);
    return;
  }
  if (envelope.type === "detail.request") {
    const payload = detailRequestSchema.parse(envelope.payload);
    gateway.send("detail.response", answerDetail(host.db, payload));
    return;
  }
  if (
    envelope.type === "summary.ack" ||
    envelope.type === "raw.ack" ||
    envelope.type === "observe.ack"
  ) {
    const payload = summaryAckSchema.parse(envelope.payload);
    ackJournal(host.db, payload.stream, payload.syncSeq);
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
