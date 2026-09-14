/**
 * 연결된 runtime 소켓. 배포·실행 메시지를 보낸다.
 */
import { randomUUID } from "node:crypto";
import type { RuntimeEnvelope } from "@howling/contracts";
import type { WebSocket } from "ws";

export interface HubSocket {
  socket: WebSocket;
  generation: number;
  siteId: string;
  runtimeId: string;
}

const live = new Map<string, HubSocket>();

export const attachRuntime = (entry: HubSocket): HubSocket | undefined => {
  let previous: HubSocket | undefined;
  for (const [id, current] of live) {
    if (current.siteId === entry.siteId && current.socket !== entry.socket) {
      live.delete(id);
      previous = current;
    }
  }
  live.set(entry.runtimeId, entry);
  return previous && previous.socket !== entry.socket ? previous : undefined;
};

export const detachRuntime = (runtimeId: string, socket: WebSocket): boolean => {
  const current = live.get(runtimeId);
  if (current?.socket !== socket) {
    return false;
  }
  live.delete(runtimeId);
  return true;
};

export const runtimeBySite = (siteId: string): HubSocket | undefined => {
  let fallback: HubSocket | undefined;
  for (const entry of live.values()) {
    if (entry.siteId !== siteId) {
      continue;
    }
    if (entry.socket.readyState === 1) {
      return entry;
    }
    fallback = entry;
  }
  return fallback;
};

export const sendToRuntime = (
  siteId: string,
  type: string,
  payload: unknown,
): boolean => {
  const entry = runtimeBySite(siteId);
  if (!entry || entry.socket.readyState !== 1) {
    return false;
  }
  const message: RuntimeEnvelope = {
    protocolVersion: 1,
    messageId: randomUUID(),
    runtimeId: entry.runtimeId,
    siteId: entry.siteId,
    connectionGeneration: entry.generation,
    type,
    payload,
  };
  entry.socket.send(JSON.stringify(message));
  return true;
};
