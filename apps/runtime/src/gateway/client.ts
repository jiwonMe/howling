/**
 * API WebSocket 연결. 재연결 때 generation을 올린다.
 */
import { HEARTBEAT_INTERVAL_MS } from "@howling/contracts";
import WebSocket from "ws";
import type { RuntimeConfig } from "../config.js";
import { heartbeatEnvelope, helloEnvelope } from "./messages.js";

export interface GatewayHandle {
  readonly stop: () => void;
}

export const startRuntimeGateway = (
  config: RuntimeConfig,
  token: string,
  factory: (url: string, token: string) => WebSocket = openSocket,
): GatewayHandle => {
  let generation = 0;
  let socket: WebSocket | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let reconnect: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  const connect = () => {
    if (stopped) {
      return;
    }
    generation += 1;
    const current = factory(config.apiUrl, token);
    socket = current;
    current.on("open", () => {
      current.send(
        JSON.stringify(
          helloEnvelope({
            runtimeId: config.runtimeId,
            siteId: config.siteId,
            generation,
          }),
        ),
      );
      heartbeat = setInterval(() => {
        if (current.readyState === WebSocket.OPEN) {
          current.send(
            JSON.stringify(
              heartbeatEnvelope({
                runtimeId: config.runtimeId,
                siteId: config.siteId,
                generation,
                sentAt: new Date().toISOString(),
              }),
            ),
          );
        }
      }, HEARTBEAT_INTERVAL_MS);
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
  };
};

const openSocket = (url: string, token: string): WebSocket =>
  new WebSocket(url, { headers: { authorization: `Bearer ${token}` } });
