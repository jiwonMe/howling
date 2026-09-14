/**
 * API WebSocket 연결. 재연결 때 generation을 올린다.
 */
import { randomUUID } from "node:crypto";
import { HEARTBEAT_INTERVAL_MS, parseRuntimeEnvelope, type RuntimeEnvelope } from "@howling/contracts";
import WebSocket from "ws";
import type { RuntimeConfig } from "../config.js";
import { heartbeatEnvelope, helloEnvelope } from "./messages.js";

export interface GatewayHandle {
  readonly stop: () => void;
  readonly send: (type: string, payload: unknown) => boolean;
  readonly setIdentity: (input: {
    readonly token: string;
    readonly runtimeId: string;
    readonly siteId: string;
  }) => void;
}

export const startRuntimeGateway = (
  config: RuntimeConfig,
  token: string,
  factory?: (url: string, token: string) => WebSocket,
  onControl?: (envelope: RuntimeEnvelope) => void,
): GatewayHandle => {
  const open = factory ?? openSocket;
  let generation = 0;
  let socket: WebSocket | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let reconnect: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  let identity = {
    token,
    runtimeId: config.runtimeId,
    siteId: config.siteId,
  };

  const connect = () => {
    if (stopped || !identity.token) {
      return;
    }
    generation += 1;
    const current = open(config.apiUrl, identity.token);
    socket = current;
    current.on("open", () => {
      current.send(
        JSON.stringify(
          helloEnvelope({
            runtimeId: identity.runtimeId,
            siteId: identity.siteId,
            generation,
          }),
        ),
      );
      heartbeat = setInterval(() => {
        if (current.readyState === WebSocket.OPEN) {
          current.send(
            JSON.stringify(
              heartbeatEnvelope({
                runtimeId: identity.runtimeId,
                siteId: identity.siteId,
                generation,
                sentAt: new Date().toISOString(),
              }),
            ),
          );
        }
      }, HEARTBEAT_INTERVAL_MS);
    });
    current.on("message", (raw) => {
      try {
        const envelope = parseRuntimeEnvelope(JSON.parse(raw.toString()));
        onControl?.(envelope);
      } catch {
        // 잘못된 제어 메시지는 연결을 유지한다.
      }
    });
    current.on("close", () => {
      if (heartbeat) {
        clearInterval(heartbeat);
      }
      if (!stopped) {
        reconnect = setTimeout(connect, 1000);
      }
    });
    current.on("error", () => {
      current.close();
    });
  };

  connect();
  return {
    stop: () => {
      stopped = true;
      if (heartbeat) {
        clearInterval(heartbeat);
      }
      if (reconnect) {
        clearTimeout(reconnect);
      }
      socket?.close();
    },
    send: (type, payload) => {
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        return false;
      }
      const message: RuntimeEnvelope = {
        protocolVersion: 1,
        messageId: randomUUID(),
        runtimeId: identity.runtimeId,
        siteId: identity.siteId,
        connectionGeneration: generation,
        type,
        payload,
      };
      socket.send(JSON.stringify(message));
      return true;
    },
    setIdentity: (next) => {
      identity = next;
      if (socket) {
        socket.close();
        return;
      }
      connect();
    },
  };
};

const openSocket = (url: string, token: string): WebSocket =>
  new WebSocket(url, { headers: { authorization: `Bearer ${token}` } });
