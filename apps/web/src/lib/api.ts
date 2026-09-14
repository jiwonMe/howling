/**
 * 같은 origin의 API를 호출한다. 401이면 로그인으로 보낸다.
 */
import {
  currentUserSchema,
  healthStatusSchema,
  readyStatusSchema,
  runtimeStatusSchema,
  siteListSchema,
  type CurrentUser,
  type HealthStatus,
  type ReadyStatus,
  type RuntimeStatus,
  type SiteSummary,
} from "@howling/contracts";

export class UnauthorizedError extends Error {
  constructor() {
    super("unauthorized");
  }
}

const read = async <T>(
  url: string,
  parse: (value: unknown) => T,
  init?: RequestInit,
): Promise<T> => {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...init,
  });
  if (response.status === 401) {
    throw new UnauthorizedError();
  }
  if (!response.ok) {
    throw new Error(`${url} ${String(response.status)}`);
  }
  return parse(await response.json());
};

export const fetchHealth = (): Promise<HealthStatus> =>
  read("/health", (value) => healthStatusSchema.parse(value));

export const fetchReady = (): Promise<ReadyStatus> =>
  read("/ready", (value) => readyStatusSchema.parse(value));

export const fetchMe = (): Promise<CurrentUser> =>
  read("/api/v1/auth/me", (value) => currentUserSchema.parse(value));

export const fetchSites = (): Promise<readonly SiteSummary[]> =>
  read("/api/v1/sites", (value) => siteListSchema.parse(value).sites);

export const fetchRuntime = (siteId: string): Promise<RuntimeStatus> =>
  read(`/api/v1/sites/${siteId}/runtime`, (value) =>
    runtimeStatusSchema.parse(value),
  );

export const logout = async (csrfToken: string): Promise<void> => {
  const response = await fetch("/api/v1/auth/logout", {
    method: "POST",
    credentials: "same-origin",
    headers: { "x-csrf-token": csrfToken },
  });
  if (!response.ok) {
    throw new Error(`logout ${String(response.status)}`);
  }
};

export const loginHref = "/api/v1/auth/login";
