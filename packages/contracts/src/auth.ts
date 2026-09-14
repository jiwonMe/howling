/**
 * 웹 세션과 공간 요약.
 */
import { z } from "zod";

export const permissionSchema = z.enum([
  "read",
  "edit",
  "deploy",
  "run",
  "data.read",
]);

export type Permission = z.infer<typeof permissionSchema>;

export const ownerPermissions: readonly Permission[] = [
  "read",
  "edit",
  "deploy",
  "run",
  "data.read",
];

export const currentUserSchema = z.object({
  id: z.string().min(1),
  email: z.string().nullable(),
  csrfToken: z.string().min(1),
});

export type CurrentUser = z.infer<typeof currentUserSchema>;

export const siteSummarySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: z.literal("owner"),
  permissions: z.array(permissionSchema),
});

export type SiteSummary = z.infer<typeof siteSummarySchema>;

export const siteListSchema = z.object({
  sites: z.array(siteSummarySchema),
});

export type SiteList = z.infer<typeof siteListSchema>;
