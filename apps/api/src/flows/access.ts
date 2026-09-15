/**
 * 이미 검사한 권한. 쿠키와 Bearer가 여기만 다르게 채운다.
 */
import { errorBody, errorCodes, type Permission } from "@howling/contracts";

export type Actor = {
  readonly siteId: string;
  readonly permissions: readonly Permission[];
  readonly flowId?: string;
};

export type ServiceResult = {
  readonly ok: boolean;
  readonly status: number;
  readonly body: unknown;
};

export const denied = (
  actor: Actor,
  need: Permission | readonly Permission[],
): ServiceResult | undefined => {
  const required = Array.isArray(need) ? need : [need];
  const missing = required.find((item) => !actor.permissions.includes(item));
  if (!missing) {
    return undefined;
  }
  return {
    ok: false,
    status: 403,
    body: errorBody(errorCodes.scopeDenied, `${missing} required`),
  };
};

export const outsideFlow = (actor: Actor, flowId: string): ServiceResult | undefined => {
  if (!actor.flowId || actor.flowId === flowId) {
    return undefined;
  }
  return {
    ok: false,
    status: 404,
    body: errorBody(errorCodes.notFound, "flow not found"),
  };
};
