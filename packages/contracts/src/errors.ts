/**
 * 제품 API·runtime이 공유하는 오류 본문.
 */
import { z } from "zod";

export const errorBodySchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
  }),
});

export type ErrorBody = z.infer<typeof errorBodySchema>;

export const errorCodes = {
  unauthorized: "unauthorized",
  forbidden: "forbidden",
  notFound: "not_found",
  conflict: "conflict",
  invalidRequest: "invalid_request",
  csrfFailed: "csrf_failed",
  runtimeOffline: "runtime_offline",
} as const;

export const errorBody = (code: string, message: string): ErrorBody => ({
  error: { code, message },
});
