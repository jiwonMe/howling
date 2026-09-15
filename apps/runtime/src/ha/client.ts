/**
 * Home Assistant WebSocket 연결.
 */
import WebSocket from "ws";
import type { HaStatus } from "@howling/contracts";
import { pendingId, readWsText } from "./ws-parse.js";

export type HaEntityRow = {
  readonly entityId: string;
  readonly state: string;
  readonly friendlyName?: string;
};

export type HaEvent = HaEntityRow & {
  readonly previous?: string;
};

export interface HaHandle {
  readonly status: () => HaStatus;
  readonly lastSyncAt: () => string | null;
  readonly callService: (
    domain: string,
    service: string,
    data: Record<string, unknown>,
  ) => Promise<unknown>;
  readonly request: (type: string, extra?: Record<string, unknown>) => Promise<unknown>;
  readonly rest: (method: string, path: string, body?: unknown) => Promise<unknown>;
  readonly stop: () => void;
}

export interface HaConnectorInput {
  readonly url: string;
  readonly token: string;
  readonly websocketPath?: string;
  readonly onStatus: (status: HaStatus) => void;
  readonly onEvent: (event: HaEvent) => void;
  readonly onEntities?: (items: readonly HaEntityRow[]) => void;
  readonly onCall?: (call: { id: number; domain: string; service: string }) => void;
}

export const startHaConnector = (input: HaConnectorInput): HaHandle => {
  let status: HaStatus = "connecting";
  let lastSyncAt: string | null = null;
  let nextId = 1;
  let socket: WebSocket | undefined;
  let stopped = false;
  const pending = new Map<number, (value: unknown) => void>();
  let snapshotDone = false;
  let subscribed = false;
  const known = new Map<string, string>();

  const setStatus = (next: HaStatus) => {
    status = next;
    input.onStatus(next);
  };

  const send = (payload: Record<string, unknown>) => {
    socket?.send(JSON.stringify(payload));
  };

  const failPending = (error: Error) => {
    for (const wait of pending.values()) {
      wait(error);
    }
    pending.clear();
  };

  const restCall = async (
    domain: string,
    service: string,
    data: Record<string, unknown>,
  ): Promise<unknown> => {
    const response = await fetch(
      `${input.url.replace(/\/$/, "")}/api/services/${domain}/${service}`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${input.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(4000),
      },
    );
    if (!response.ok) {
      throw new Error(`ha rest ${String(response.status)}`);
    }
    return response.json();
  };

  const connect = () => {
    if (stopped) {
      return;
    }
    setStatus(status === "ready" ? "reconnecting" : "connecting");
    snapshotDone = false;
    subscribed = false;
    const wsUrl =
      input.url.replace(/^http/, "ws").replace(/\/$/, "") + (input.websocketPath ?? "/api/websocket");
    const current = new WebSocket(wsUrl);
    socket = current;
    current.on("message", (raw) => {
      let message: {
        type: string;
        success?: boolean;
        id?: number | string;
        result?: unknown;
        error?: { message?: string };
        event?: {
          data?: {
            entity_id?: string;
            new_state?: { state?: string; attributes?: { friendly_name?: string } };
            old_state?: { state?: string };
          };
        };
      };
      try {
        message = JSON.parse(readWsText(raw)) as typeof message;
      } catch {
        return;
      }
      if (message.type === "auth_required") {
        setStatus("authenticating");
        send({ type: "auth", access_token: input.token });
        return;
      }
      if (message.type === "auth_ok") {
        setStatus("synchronizing");
        const statesId = nextId;
        nextId += 1;
        pending.set(statesId, (result) => {
          if (result instanceof Error || !Array.isArray(result)) {
            return;
          }
          const rows = (result as HaStateRow[]).flatMap((item) => {
            if (!item.entity_id || item.state === undefined) {
              return [];
            }
            known.set(item.entity_id, item.state);
            return [rowOf(item)];
          });
          input.onEntities?.(rows);
          snapshotDone = true;
          if (subscribed) {
            lastSyncAt = new Date().toISOString();
            setStatus("ready");
          }
        });
        send({ id: statesId, type: "get_states" });
        const servicesId = nextId;
        nextId += 1;
        pending.set(servicesId, () => undefined);
        send({ id: servicesId, type: "get_services" });
        const subId = nextId;
        nextId += 1;
        pending.set(subId, () => {
          subscribed = true;
          if (snapshotDone) {
            lastSyncAt = new Date().toISOString();
            setStatus("ready");
          }
        });
        send({ id: subId, type: "subscribe_events", event_type: "state_changed" });
        return;
      }
      if (message.type === "auth_invalid") {
        setStatus("error");
        current.close();
        return;
      }
      const id = pendingId(message.id);
      if (message.type === "result" && id !== undefined) {
        const wait = pending.get(id);
        pending.delete(id);
        if (message.success === false) {
          wait?.(new Error(message.error?.message ?? "ha request failed"));
          return;
        }
        wait?.(message.result);
        return;
      }
      if (message.type === "event" && status === "ready") {
        const data = message.event?.data;
        const entityId = data?.entity_id;
        const next = data?.new_state?.state;
        if (!entityId || next === undefined) {
          return;
        }
        const previous = known.get(entityId);
        known.set(entityId, next);
        const friendlyName = data.new_state?.attributes?.friendly_name;
        input.onEvent({
          entityId,
          state: next,
          ...(previous === undefined ? {} : { previous }),
          ...(friendlyName ? { friendlyName } : {}),
        });
      }
    });
    current.on("close", () => {
      if (socket !== current) {
        return;
      }
      if (!stopped && status !== "error") {
        setStatus("disconnected");
        setTimeout(connect, 2000);
      }
    });
    current.on("error", () => {
      current.close();
    });
  };

  connect();
  return {
    status: () => status,
    lastSyncAt: () => lastSyncAt,
    callService: async (domain, service, data) => {
      const id = nextId;
      nextId += 1;
      input.onCall?.({ id, domain, service });
      return restCall(domain, service, data);
    },
    request: (type, extra = {}) => {
      if (stopped || !socket || socket.readyState !== WebSocket.OPEN) {
        return Promise.reject(new Error("ha disconnected"));
      }
      const id = nextId;
      nextId += 1;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error("ha request timeout"));
        }, 8000);
        pending.set(id, (value) => {
          clearTimeout(timer);
          if (value instanceof Error) {
            reject(value);
            return;
          }
          resolve(value);
        });
        send({ id, type, ...extra });
      });
    },
    rest: async (method, path, body) => {
      const response = await fetch(`${input.url.replace(/\/$/, "")}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${input.token}`,
          ...(body !== undefined ? { "content-type": "application/json" } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(20_000),
      });
      const text = await response.text();
      let parsed: unknown;
      try {
        parsed = text ? (JSON.parse(text) as unknown) : undefined;
      } catch {
        parsed = text;
      }
      if (!response.ok) {
        const message =
          parsed && typeof parsed === "object" && "message" in parsed && typeof parsed.message === "string"
            ? parsed.message
            : "";
        throw new Error(`ha rest ${String(response.status)}${message ? ` ${message}` : ""}`);
      }
      return parsed;
    },
    stop: () => {
      stopped = true;
      failPending(new Error("ha stopped"));
      socket?.close();
    },
  };
};

type HaStateRow = {
  readonly entity_id?: string;
  readonly state?: string;
  readonly attributes?: { readonly friendly_name?: string };
};

const rowOf = (item: HaStateRow): HaEntityRow => ({
  entityId: item.entity_id ?? "",
  state: item.state ?? "",
  ...(item.attributes?.friendly_name ? { friendlyName: item.attributes.friendly_name } : {}),
});
