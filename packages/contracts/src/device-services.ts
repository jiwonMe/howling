/**
 * 종류별 HA 도메인 서비스. 조회(browse_media)와 통합 전용 서비스는 없다.
 */
import { HOME_SERVICES } from "./device-services-home.js";
import { PLAYER_SERVICES, REMOTE_SERVICES } from "./device-services-media.js";
import type { DeviceActionField, DeviceService } from "./device-services-types.js";
import type { DeviceKind } from "./devices.js";

export type { DeviceActionField, DeviceService } from "./device-services-types.js";

const SERVICES: Readonly<Record<DeviceKind, readonly DeviceService[]>> = {
  ...HOME_SERVICES,
  player: PLAYER_SERVICES,
  remote: REMOTE_SERVICES,
};

export const actionsOf = (kind: DeviceKind): readonly string[] =>
  SERVICES[kind].map((item) => item.action);

export const fieldsOf = (kind: DeviceKind, action: string): readonly DeviceActionField[] =>
  SERVICES[kind].find((item) => item.action === action)?.fields ?? [];
