/**
 * 허브가 올린 기기. entity_id는 보여주지 않는다.
 */
import {
  actionLabel,
  DEVICE_KIND_LABELS,
  originLabel,
  originOf,
  stateLabel,
  type DeviceSummary,
} from "@howling/contracts";
import { useEffect, useState } from "react";
import { loginHref, UnauthorizedError } from "../lib/api.js";
import { haStatus } from "../lib/dashboard.js";
import { getDevices } from "../lib/devices-api.js";
import { loadStatus } from "../lib/status.js";
import { caption, header, page, subtitle, title } from "../ui/layout.css.js";
import { empty, tableCell, tableHead, tableWrap } from "../ui/table.css.js";
import { DeviceConnectForm } from "./device-connect-form.js";
import { DeviceManage } from "./device-manage.js";

export const DevicesPage = () => {
  const [devices, setDevices] = useState<DeviceSummary[]>();
  const [error, setError] = useState<string>();
  const [siteId, setSiteId] = useState<string>();
  const [csrf, setCsrf] = useState<string>();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const status = await loadStatus();
        const listed = await getDevices(status.site.id);
        if (!cancelled) {
          setSiteId(status.site.id);
          setCsrf(status.user.csrfToken);
          setReady(status.runtime.online && haStatus(status.runtime) === "ready");
          setDevices(listed.devices);
          setError(undefined);
        }
      } catch (caught) {
        if (caught instanceof UnauthorizedError) {
          window.location.assign(loginHref);
          return;
        }
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "기기를 불러오지 못했습니다.");
        }
      }
    };
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  if (error && !devices) {
    return (
      <div className={page({ tone: "error" })}>
        <p>{error}</p>
      </div>
    );
  }

  if (!devices || !siteId || !csrf) {
    return (
      <div className={page({ tone: "muted" })}>
        <p>기기를 불러오는 중…</p>
      </div>
    );
  }

  return (
    <div className={page()}>
      <header className={header}>
        <div>
          <h1 className={title}>기기</h1>
          <p className={subtitle}>지금 상태와 동작을 봅니다. 허브 화면을 열지 않아도 됩니다.</p>
        </div>
      </header>
      <DeviceConnectForm
        csrf={csrf}
        ready={ready}
        siteId={siteId}
        onDevices={(listed) => {
          setDevices((current) => listed.reduce((next, item) => mergeDevice(next, item), current ?? []));
        }}
      />
      {devices.length === 0 ? (
        <p className={empty}>아직 기기가 없습니다. 위에서 연결하거나 허브 기기를 기다립니다.</p>
      ) : (
        <div className={tableWrap} data-testid="device-list">
          <table>
            <thead>
              <tr>
                <th className={tableHead} scope="col">
                  이름
                </th>
                <th className={tableHead} scope="col">
                  종류
                </th>
                <th className={tableHead} scope="col">
                  구분
                </th>
                <th className={tableHead} scope="col">
                  현재
                </th>
                <th className={tableHead} scope="col">
                  동작
                </th>
                <th className={tableHead} scope="col">
                  연결
                </th>
                <th className={tableHead} scope="col">
                  관리
                </th>
              </tr>
            </thead>
            <tbody>
              {devices.map((item) => (
                <tr data-origin={originOf(item)} data-testid="device-row" key={item.id}>
                  <td className={tableCell}>{item.name}</td>
                  <td className={tableCell}>{DEVICE_KIND_LABELS[item.kind]}</td>
                  <td className={tableCell}>{originLabel(item)}</td>
                  <td className={tableCell}>
                    {item.available ? stateLabel(item.state) : "불가"}
                    {item.available && item.reading ? ` · ${item.reading}` : ""}
                  </td>
                  <td className={tableCell}>
                    {item.actions.map((action) => actionLabel(action)).join(", ") || "—"}
                  </td>
                  <td className={tableCell}>{item.available ? "사용 가능" : "불가"}</td>
                  <td className={tableCell}>
                    <DeviceManage
                      csrf={csrf}
                      device={item}
                      siteId={siteId}
                      onDevice={(device) => setDevices((current) => mergeDevice(current ?? [], device))}
                      onGone={(deviceId) =>
                        setDevices((current) => (current ?? []).filter((row) => row.id !== deviceId))
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className={caption}>클라우드에는 이름·종류·현재값만 있습니다. entity id는 없습니다.</p>
    </div>
  );
};

const mergeDevice = (current: readonly DeviceSummary[], device: DeviceSummary): DeviceSummary[] => {
  const next = current.filter((item) => item.id !== device.id);
  next.push(device);
  return next.sort((left, right) => left.name.localeCompare(right.name));
};
