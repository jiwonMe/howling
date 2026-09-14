/**
 * 프로세스 health와 의존성 readiness.
 * HA·runtime 연결 여부는 ready에 넣지 않는다.
 */
import { z } from "zod";

export const healthServiceSchema = z.enum(["api", "runtime", "oidc"]);

export const healthStatusSchema = z.object({
  status: z.literal("ok"),
  service: healthServiceSchema,
});

export type HealthStatus = z.infer<typeof healthStatusSchema>;

export const readyChecksSchema = z.object({
  database: z.boolean(),
  migrations: z.boolean(),
});

export const readyStatusSchema = z.object({
  status: z.enum(["ready", "not_ready"]),
  service: z.enum(["api", "runtime"]),
  checks: readyChecksSchema,
});

export type ReadyStatus = z.infer<typeof readyStatusSchema>;
