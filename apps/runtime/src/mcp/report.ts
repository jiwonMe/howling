/**
 * HA + MCP snapshot을 올린다. 원문 tool 응답은 넣지 않는다.
 */
import type { HaStatus, McpSnapshot } from "@howling/contracts";
import type { GatewayHandle } from "../gateway/client.js";

export const reportConnections = (
  gateway: GatewayHandle,
  ha: { readonly status: HaStatus; readonly lastSyncAt: string | null },
  mcp: McpSnapshot,
): void => {
  const connectors = ["homeassistant"];
  if (mcp.servers.length > 0) {
    connectors.push("mcp");
  }
  gateway.setConnectors(connectors);
  gateway.send("connections.snapshot", {
    ha: { status: ha.status, lastSyncAt: ha.lastSyncAt },
    mcp,
  });
};
