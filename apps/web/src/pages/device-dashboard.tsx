/**
 * 기기 현재값. 누르면 켜고 끈다. HA로 가지 않는다.
 */
import {
  DEVICE_KIND_LABELS,
  onDeviceBoard,
  stateLabel,
  type DeviceSummary,
} from "@howling/contracts";
import { useState } from "react";
import { caption, section, sectionTitle } from "../ui/layout.css.js";
import { empty } from "../ui/table.css.js";
import { board, tile, tileKind, tileName, tileReading, tileState } from "./device-dashboard.css.js";
import { DeviceDialog } from "./device-dialog.js";

export const DeviceDashboard = (props: {
  readonly devices: readonly DeviceSummary[];
  readonly siteId?: string;
  readonly csrf?: string;
  readonly onDevice?: (device: DeviceSummary) => void;
}) => {
  const [openId, setOpenId] = useState<string>();
  const listed = props.devices.filter(
    (item, _, all) =>
      onDeviceBoard(item.kind) &&
      (item.available ||
        !all.some((other) => other.available && other.name === item.name && other.kind === item.kind)),
  );
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
      <p className={caption}>눌러서 켜고 끕니다. 허브 화면을 열지 않아도 됩니다.</p>
      <div className={board} data-testid="device-dashboard">
        {listed.map((item) => (
          <button
            className={tile({ available: item.available })}
            data-testid="device-tile"
            key={item.id}
            type="button"
            onClick={() => setOpenId(item.id)}
          >
            <p className={tileKind}>{DEVICE_KIND_LABELS[item.kind]}</p>
            <p className={tileName}>{item.name}</p>
            <p className={tileState({ live: item.available && isOn(item) })}>{nowOf(item)}</p>
            {item.available && item.reading ? <p className={tileReading}>{item.reading}</p> : null}
          </button>
        ))}
      </div>
      {open && props.siteId && props.csrf ? (
        <DeviceDialog
          csrf={props.csrf}
          device={open}
          siteId={props.siteId}
          onClose={() => setOpenId(undefined)}
          onDevice={(device) => props.onDevice?.(device)}
        />
      ) : null}
    </section>
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
