/**
 * Draft/editor 쓰기 결과.
 */
import { errorBody, errorCodes } from "@howling/contracts";

export const writeResult = (
  reply: { code: (status: number) => { send: (body: unknown) => unknown } },
  result: "ok" | "conflict" | "missing",
) => {
  if (result === "conflict") {
    return reply.code(409).send(errorBody(errorCodes.conflict, "version conflict"));
  }
  if (result === "missing") {
    return reply.code(404).send(errorBody(errorCodes.notFound, "not found"));
  }
  return { ok: true };
};
