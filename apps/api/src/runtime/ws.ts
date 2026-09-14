/**
 * Runtime이 여는 WebSocket. hello와 heartbeat만 처리한다.
 */
import { randomUUID } from "node:crypto";
import {
  HEARTBEAT_TIMEOUT_MS,
  capabilitiesPayloadSchema,
  heartbeatAckPayloadSchema,
  heartbeatPayloadSchema,
  helloPayloadSchema,
  parseRuntimeEnvelope,
  type RuntimeEnvelope,
} from "@howling/contracts";
import type { FastifyInstance } from "fastify";
import type pg from "pg";
import type { WebSocket } from "ws";
import {
  authenticateRuntime,
  expireSilentRuntimes,
  markRuntimeHello,
  markRuntimeOffline,
  touchRuntime,
} from "./registry.js";
import { attachRuntime, detachRuntime } from "./hub.js";
import { handleRuntimeControl } from "./inbound.js";

interface LiveSocket {
  socket: WebSocket;
  generation: number;
}

export const registerRuntimeGateway = (
  app: FastifyInstance,
  pool: pg.Pool,
): void => {
  const live = new Map<string, LiveSocket>();

  const timer = setInterval(() => {
    void expireSilentRuntimes(pool);
  }, HEARTBEAT_TIMEOUT_MS / 3);
  app.addHook("onClose", async () => {
    clearInterval(timer);
    for (const entry of live.values()) {
      entry.socket.close();
    }
  });

  app.get("/api/v1/runtime/ws", { websocket: true }, (socket, request) => {
    const header = request.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    void authenticateRuntime(pool, token).then((identity) => {
      if (!identity) {
        socket.close(4401, "unauthorized");
        return;
      }
      socket.on("message", (raw) => {
        void handleMessage(pool, live, socket, identity.runtimeId, raw);
      });
      socket.on("close", () => {
        if (detachRuntime(identity.runtimeId, socket)) {
          const current = live.get(identity.runtimeId);
          live.delete(identity.runtimeId);
          void markRuntimeOffline(pool, identity.runtimeId, current?.generation);
        }
      });
    });
  });

};

const handleMessage = async (
  pool: pg.Pool,
  live: Map<string, LiveSocket>,
  socket: WebSocket,
  expectedRuntimeId: string,
  raw: Buffer | ArrayBuffer | Buffer[],
): Promise<void> => {
  let envelope: RuntimeEnvelope;
  try {
    envelope = parseRuntimeEnvelope(JSON.parse(raw.toString()));
  } catch {
    socket.close(4400, "invalid envelope");
    return;
  }
  if (envelope.runtimeId !== expectedRuntimeId) {
    socket.close(4403, "runtime mismatch");
    return;
  }
  if (envelope.type === "hello") {
    const payload = helloPayloadSchema.parse(envelope.payload);
    const replaced = attachRuntime({
      socket,
      generation: envelope.connectionGeneration,
      siteId: envelope.siteId,
      runtimeId: envelope.runtimeId,
    });
    if (replaced) {
      replaced.socket.close(4409, "replaced");
    }
    live.set(envelope.runtimeId, {
      socket,
      generation: envelope.connectionGeneration,
    });
    await markRuntimeHello(pool, {
      runtimeId: envelope.runtimeId,
      generation: envelope.connectionGeneration,
      capabilities: payload.capabilities,
    });
    sendEnvelope(socket, {
      ...baseEnvelope(envelope),
      type: "capabilities",
      payload: capabilitiesPayloadSchema.parse({
        connectors: payload.capabilities.connectors,
      }),
    });
    return;
  }
  if (envelope.type === "heartbeat") {
    heartbeatPayloadSchema.parse(envelope.payload);
    await touchRuntime(pool, envelope.runtimeId);
    sendEnvelope(socket, {
      ...baseEnvelope(envelope),
      type: "heartbeat.ack",
      payload: heartbeatAckPayloadSchema.parse({
        receivedAt: new Date().toISOString(),
      }),
    });
    return;
  }
  await handleRuntimeControl(pool, envelope);
};

const baseEnvelope = (envelope: RuntimeEnvelope) => ({
  protocolVersion: 1 as const,
  messageId: randomUUID(),
  runtimeId: envelope.runtimeId,
  siteId: envelope.siteId,
  connectionGeneration: envelope.connectionGeneration,
  correlationId: envelope.messageId,
});

const sendEnvelope = (socket: WebSocket, message: RuntimeEnvelope): void => {
  socket.send(JSON.stringify(message));
};
