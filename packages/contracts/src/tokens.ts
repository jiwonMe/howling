/**
 * Scoped API token. 원문은 발급 응답에만 있다.
 */
import { z } from "zod";
import { permissionSchema } from "./auth.js";

export const issueTokenRequestSchema = z.object({
  name: z.string().min(1).max(80),
  scopes: z.array(permissionSchema).min(1),
  flowId: z.string().min(1).optional(),
});

export const issuedTokenSchema = z.object({
  id: z.string().min(1),
  token: z.string().min(1),
});

export const tokenListItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  scopes: z.array(permissionSchema),
  flowId: z.string().nullable(),
  createdAt: z.string().datetime(),
  lastUsedAt: z.string().datetime().nullable(),
  revokedAt: z.string().datetime().nullable(),
});

export const tokenListSchema = z.object({
  tokens: z.array(tokenListItemSchema),
});

export type IssueTokenRequest = z.infer<typeof issueTokenRequestSchema>;
export type IssuedToken = z.infer<typeof issuedTokenSchema>;
export type TokenListItem = z.infer<typeof tokenListItemSchema>;
