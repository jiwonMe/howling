/**
 * 가상 제품 한 대가 만드는 종류. 허브는 대표 기기 한 대다.
 */
import { DEVICE_INTEGRATIONS, type DeviceIntegrationId } from "./device-integrations.js";
import type { DeviceKind } from "./devices.js";

export type ProductPart = {
  readonly kind: DeviceKind;
  readonly suffix: string;
  readonly numeric?: boolean;
};

const one = (kind: DeviceKind): readonly ProductPart[] => [{ kind, suffix: "" }];

const RECIPES: Readonly<Record<DeviceIntegrationId, readonly ProductPart[]>> = {
  hue: one("light"),
  tradfri: one("light"),
  tplink: one("switch"),
  tuya: one("switch"),
  yeelight: one("light"),
  wiz: one("light"),
  lifx: one("light"),
  nanoleaf: one("light"),
  govee: one("light"),
  meross: one("switch"),
  switchbot: one("switch"),
  wemo: one("switch"),
  shelly: one("switch"),
  wled: one("light"),
  xiaomi_miio: one("switch"),
  lg_thinq: one("climate"),
  smartthings: one("switch"),
  home_connect: one("switch"),
  irobot: one("vacuum"),
  androidtv: [
    { kind: "player", suffix: "" },
    { kind: "remote", suffix: "리모컨" },
  ],
  denonavr: one("player"),
  esphome: one("switch"),
  tasmota: one("switch"),
  broadlink: one("remote"),
  harmony: one("remote"),
  overkiz: one("cover"),
  gree: one("climate"),
  mill: one("climate"),
  sonos: one("player"),
  cast: one("player"),
  samsungtv: [
    { kind: "player", suffix: "" },
    { kind: "remote", suffix: "리모컨" },
  ],
  webostv: one("player"),
  apple_tv: [
    { kind: "player", suffix: "" },
    { kind: "remote", suffix: "리모컨" },
    { kind: "binary", suffix: "키보드" },
  ],
  homekit_controller: one("light"),
  matter: one("light"),
  lutron_caseta: one("light"),
  bond: one("fan"),
  roborock: one("vacuum"),
};

export const productIdOf = (raw: string): DeviceIntegrationId | undefined => {
  const text = raw.trim();
  const found = DEVICE_INTEGRATIONS.find(
    (item) => item.id === text || item.name.toLowerCase() === text.toLowerCase(),
  );
  return found?.id;
};

export const productPartsOf = (raw: string): readonly ProductPart[] | undefined => {
  const id = productIdOf(raw);
  return id ? RECIPES[id] : undefined;
};

export const productNameOf = (name: string, suffix: string): string =>
  suffix === "" ? name : `${name} ${suffix}`;
