/**
 * HA WebSocket 프레임·id를 안전하게 읽는다.
 */
export const readWsText = (raw: unknown): string => {
  if (typeof raw === "string") {
    return raw;
  }
  if (Buffer.isBuffer(raw)) {
    return raw.toString("utf8");
  }
  if (Array.isArray(raw) && raw.every((part) => Buffer.isBuffer(part))) {
    return Buffer.concat(raw).toString("utf8");
  }
  if (raw instanceof ArrayBuffer) {
    return Buffer.from(raw).toString("utf8");
  }
  return String(raw);
};

export const pendingId = (id: unknown): number | undefined => {
  const value = typeof id === "number" ? id : Number(id);
  return Number.isInteger(value) ? value : undefined;
};
