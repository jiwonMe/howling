/**
 * 기기 현재값. 집과 가상을 나눈다. HA로 가지 않는다.
 */
import {
  DEVICE_KIND_LABELS,
  onDeviceBoard,
  originLabel,
  originOf,
  stateLabel,
  type DeviceOrigin,
  type DeviceSummary,
} from "@howling/contracts";
import { useState } from "react";
import { caption, section, sectionTitle } from "../ui/layout.css.js";
import { empty } from "../ui/table.css.js";
import {
  board,
  group,
  groupTitle,
  tile,
  tileKind,
  tileName,
  tileReading,
  tileState,
} from "./device-dashboard.css.js";
import { DeviceDialog } from "./device-dialog.js";

export const DeviceDashboard = (props: {
  readonly devices: readonly DeviceSummary[];
  readonly siteId?: string;
  readonly csrf?: string;
  readonly onDevice?: (device: DeviceSummary) => void;
  readonly onGone?: (deviceId: string) => void;
}) => {
  const [openId, setOpenId] = useState<string>();
  const listed = props.devices.filter(
    (item, _, all) =>
      onDeviceBoard(item.kind) &&
      (item.available ||
        !all.some((other) => other.available && other.name === item.name && other.kind === item.kind)),
  );
  const home = listed.filter((item) => originOf(item) === "ha");
  const virtual = listed.filter((item) => originOf(item) === "virtual");
  const open = listed.find((item) => item.id === openId) ?? props.devices.find((item) => item.id === openId);
  if (listed.length === 0) {
    return (
      <section className={section}>
        <h2 className={sectionTitle}>기기</h2>
        <p className={empty}>아직 볼 기기가 없습니다. 기기에서 연결하면 여기에 상태가 나타납니다.</p>
      </section>
    );
  }
  return (
    <section className={section}>
      <h2 className={sectionTitle}>기기</h2>
      <p className={caption}>집 기기와 가상 기기를 나눠 봅니다. 눌러서 켜고 끕니다.</p>
      <DeviceGroup devices={home} origin="ha" onOpen={setOpenId} />
      <DeviceGroup devices={virtual} origin="virtual" onOpen={setOpenId} />
      {open && props.siteId && props.csrf ? (
        <DeviceDialog
          csrf={props.csrf}
          device={open}
          siteId={props.siteId}
          onClose={() => setOpenId(undefined)}
          onDevice={(device) => props.onDevice?.(device)}
          onGone={(deviceId) => {
            setOpenId(undefined);
            props.onGone?.(deviceId);
          }}
        />
      ) : null}
    </section>
  );
};

const DeviceGroup = (props: {
  readonly origin: DeviceOrigin;
  readonly devices: readonly DeviceSummary[];
  readonly onOpen: (id: string) => void;
}) => {
  if (props.devices.length === 0) {
    return null;
  }
  return (
    <div className={group} data-testid={`device-group-${props.origin}`}>
      <h3 className={groupTitle}>{props.origin === "virtual" ? "가상 기기" : "집 기기"}</h3>
      <div className={board} data-testid={props.origin === "ha" ? "device-dashboard" : "device-dashboard-virtual"}>
        {props.devices.map((item) => (
          <button
            className={tile({ available: item.available })}
            data-origin={originOf(item)}
            data-testid="device-tile"
            key={item.id}
            type="button"
            onClick={() => props.onOpen(item.id)}
          >
            <p className={tileKind}>
              {DEVICE_KIND_LABELS[item.kind]} · {originLabel(item)}
            </p>
            <p className={tileName}>{item.name}</p>
            <p className={tileState({ live: item.available && isOn(item) })}>{nowOf(item)}</p>
            {item.available && item.reading ? <p className={tileReading}>{item.reading}</p> : null}
          </button>
        ))}
      </div>
    </div>
  );
};

const nowOf = (item: DeviceSummary): string => {
  if (!item.available) {
    return "불가";
  }
  return stateLabel(item.state);
};

const isOn = (item: DeviceSummary): boolean => {
  const state = item.state ?? "";
  if (state === "" || state === "off" || state === "idle" || state === "unavailable") {
    return false;
  }
  return true;
};
