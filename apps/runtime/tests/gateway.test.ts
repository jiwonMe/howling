import { createServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { describe, expect, it } from "vitest";
import { parseRuntimeEnvelope } from "@howling/contracts";
import { loadRuntimeConfig } from "../src/config.js";
import { startRuntimeGateway } from "../src/gateway/client.js";

describe("runtime gateway", () => {
  it("sends hello then heartbeat to the API socket", async () => {
    const server = createServer();
    const wss = new WebSocketServer({ server, path: "/api/v1/runtime/ws" });
    const received: string[] = [];
    const gotTwo = new Promise<void>((resolve) => {
      wss.on("connection", (socket: WebSocket) => {
        socket.on("message", (raw) => {
          received.push(raw.toString());
          if (received.length >= 2) {
            resolve();
          }
        });
      });
    });
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    const gateway = startRuntimeGateway(
      loadRuntimeConfig({
        RUNTIME_API_URL: `ws://127.0.0.1:${String(port)}/api/v1/runtime/ws`,
        RUNTIME_ID: "runtime_dev",
        RUNTIME_SITE_ID: "site_dev",
      }),
      "dev-runtime-token",
    );
    const first = await new Promise<string>((resolve) => {
      const timer = setInterval(() => {
        if (received[0]) {
          clearInterval(timer);
          resolve(received[0]);
        }
      }, 20);
    });
    expect(parseRuntimeEnvelope(JSON.parse(first)).type).toBe("hello");
    gateway.stop();
    wss.close();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    void gotTwo;
  });
});
