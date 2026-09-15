/**
 * adapter === "mcp"이면 call_tool. dispatchStarted persist 뒤에만 호출된다.
 */
import { mcpEffectInputSchema } from "@howling/contracts";
import type { EffectRequest } from "@howling/core";
import type { AdapterCall, AdapterResult, FakeAdapter } from "../effects/fake-adapter.js";
import type { McpRegistry } from "./registry.js";

export const createMcpAwareAdapter = (input: {
  readonly next: FakeAdapter;
  readonly registry: () => McpRegistry | undefined;
}): FakeAdapter => {
  const calls: AdapterCall[] = input.next.calls;
  return {
    calls,
    execute: async (request: EffectRequest): Promise<AdapterResult> => {
      const intent = request.intent;
      if (intent.kind !== "external" || intent.adapter !== "mcp") {
        return input.next.execute(request);
      }
      calls.push({
        effectId: request.id,
        adapter: intent.adapter,
        operation: intent.operation,
      });
      if (intent.operation !== "call_tool") {
        return { source: "live", status: "failed", error: { code: "INVALID_MCP", message: "call_tool only" } };
      }
      const parsed = mcpEffectInputSchema.safeParse(intent.input);
      if (!parsed.success) {
        return {
          source: "live",
          status: "failed",
          error: { code: "INVALID_MCP", message: "connectionId and tool required" },
        };
      }
      const registry = input.registry();
      const open = registry?.get(parsed.data.connectionId);
      if (!open) {
        return { source: "live", status: "unknown", reason: "mcp is not ready" };
      }
      const tool = open.tools.find((item) => item.tool === parsed.data.tool);
      if (!tool) {
        return { source: "live", status: "unknown", reason: "mcp tool missing" };
      }
      if (
        parsed.data.inputSchemaDigest &&
        parsed.data.inputSchemaDigest !== tool.inputSchemaDigest
      ) {
        return { source: "live", status: "unknown", reason: "mcp schema digest mismatch" };
      }
      try {
        const value = await withTimeout(
          open.session.callTool(parsed.data.tool, parsed.data.arguments),
          8_000,
        );
        return { source: "live", status: "succeeded", value: redactMcp(value) as never };
      } catch (error) {
        return {
          source: "live",
          status: "unknown",
          reason: error instanceof Error ? error.message : "mcp call lost",
        };
      }
    },
  };
};

const withTimeout = async <T>(promise: Promise<T>, ms: number): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("mcp timeout")), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
};

const redactMcp = (value: unknown): { ok: true; tool?: string } => {
  if (!value || typeof value !== "object") {
    return { ok: true };
  }
  const record = value as { content?: { type?: string; text?: string }[] };
  const text = record.content?.find((item) => item.type === "text")?.text;
  if (!text) {
    return { ok: true };
  }
  try {
    const parsed = JSON.parse(text) as { echoed?: boolean };
    return parsed.echoed ? { ok: true, tool: "echo" } : { ok: true };
  } catch {
    return { ok: true };
  }
};
