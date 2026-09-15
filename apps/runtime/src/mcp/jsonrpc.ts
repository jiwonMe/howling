/**
 * MCP JSON-RPC 2.0. definition에 transport를 넣지 않는다.
 */
export type JsonRpcId = string | number;

export type JsonRpcRequest = {
  readonly jsonrpc: "2.0";
  readonly id: JsonRpcId;
  readonly method: string;
  readonly params?: unknown;
};

export type JsonRpcSuccess = {
  readonly jsonrpc: "2.0";
  readonly id: JsonRpcId;
  readonly result: unknown;
};

export type JsonRpcFailure = {
  readonly jsonrpc: "2.0";
  readonly id: JsonRpcId | null;
  readonly error: { readonly code: number; readonly message: string };
};

export const rpcRequest = (
  id: JsonRpcId,
  method: string,
  params?: unknown,
): JsonRpcRequest => ({
  jsonrpc: "2.0",
  id,
  method,
  ...(params === undefined ? {} : { params }),
});

export const rpcResult = (id: JsonRpcId, result: unknown): JsonRpcSuccess => ({
  jsonrpc: "2.0",
  id,
  result,
});

export const rpcError = (
  id: JsonRpcId | null,
  code: number,
  message: string,
): JsonRpcFailure => ({
  jsonrpc: "2.0",
  id,
  error: { code, message },
});

export const readRpcResult = (body: unknown): unknown => {
  if (!body || typeof body !== "object") {
    throw new Error("invalid json-rpc body");
  }
  const value = body as { error?: { message?: string }; result?: unknown };
  if (value.error) {
    throw new Error(value.error.message ?? "mcp error");
  }
  return value.result;
};
