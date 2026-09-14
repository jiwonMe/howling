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
  type RuntimeIdentity,
} from "./registry.js";
import { attachRuntime, detachRuntime } from "./hub.js";
import { handleRuntimeControl } from "./inbound.js";

interface LiveSocket {
  socket: WebSocket;
  generation: number;
}

type SocketMessage = Buffer | ArrayBuffer | Buffer[];

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
    acceptRuntimeSocket(pool, live, socket, token);
  });
};

const acceptRuntimeSocket = (
  pool: pg.Pool,
  live: Map<string, LiveSocket>,
  socket: WebSocket,
  token: string,
): void => {
  const pending: SocketMessage[] = [];
  let queue = Promise.resolve();
  let identity: RuntimeIdentity | undefined;

  const enqueue = (raw: SocketMessage) => {
    if (!identity) {
      return;
    }
    const current = identity;
    queue = queue
      .then(() => handleMessage(pool, live, socket, current, raw))
      .catch(() => undefined);
  };

  socket.on("message", (raw) => {
    if (!identity) {
      pending.push(raw);
      return;
    }
    enqueue(raw);
  });

  void authenticateRuntime(pool, token).then((found) => {
    if (!found) {
      pending.length = 0;
      socket.close(4401, "unauthorized");
      return;
    }
    identity = found;
    socket.on("close", () => {
      if (detachRuntime(found.runtimeId, socket)) {
        const current = live.get(found.runtimeId);
        live.delete(found.runtimeId);
        void markRuntimeOffline(pool, found.runtimeId, current?.generation);
      }
    });
    for (const raw of pending.splice(0)) {
      enqueue(raw);
    }
  });
};

const handleMessage = async (
  pool: pg.Pool,
  live: Map<string, LiveSocket>,
  socket: WebSocket,
  identity: RuntimeIdentity,
  raw: SocketMessage,
): Promise<void> => {
  let envelope: RuntimeEnvelope;
  try {
    envelope = parseRuntimeEnvelope(JSON.parse(raw.toString()));
  } catch {
    socket.close(4400, "invalid envelope");
    return;
  }
  if (envelope.runtimeId !== identity.runtimeId) {
    socket.close(4403, "runtime mismatch");
    return;
  }
  if (envelope.type === "hello") {
    const payload = helloPayloadSchema.parse(envelope.payload);
    bindHub(live, socket, identity, envelope);
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
    bindHub(live, socket, identity, envelope);
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

const bindHub = (
  live: Map<string, LiveSocket>,
  socket: WebSocket,
  identity: RuntimeIdentity,
  envelope: RuntimeEnvelope,
): void => {
  const replaced = attachRuntime({
    socket,
    generation: envelope.connectionGeneration,
    siteId: identity.siteId,
    runtimeId: envelope.runtimeId,
  });
  if (replaced) {
    replaced.socket.close(4409, "replaced");
  }
  live.set(envelope.runtimeId, {
    socket,
    generation: envelope.connectionGeneration,
  });
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
