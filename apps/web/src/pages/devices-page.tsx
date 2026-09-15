/**
 * 허브가 올린 기기. entity_id는 보여주지 않는다.
 */
import type { DeviceSummary } from "@howling/contracts";
import { useEffect, useState } from "react";
import { loginHref, UnauthorizedError } from "../lib/api.js";
import { haStatus } from "../lib/dashboard.js";
import { getDevices } from "../lib/devices-api.js";
import { loadStatus } from "../lib/status.js";
import { caption, header, page, subtitle, title } from "../ui/layout.css.js";
import { empty, tableCell, tableHead, tableWrap } from "../ui/table.css.js";
import { DeviceConnectForm } from "./device-connect-form.js";

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
          <p className={subtitle}>이름과 동작만 보입니다. 허브에 있는 기기도 여기 나타납니다.</p>
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
                  동작
                </th>
                <th className={tableHead} scope="col">
                  상태
                </th>
              </tr>
            </thead>
            <tbody>
              {devices.map((item) => (
                <tr key={item.id}>
                  <td className={tableCell}>{item.name}</td>
                  <td className={tableCell}>{kindLabel(item.kind)}</td>
                  <td className={tableCell}>{item.actions.join(", ") || "—"}</td>
                  <td className={tableCell}>{item.available ? "사용 가능" : "불가"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className={caption}>클라우드에는 이름과 종류만 있습니다. 집 기기는 위에서 연결합니다.</p>
    </div>
  );
};

const KIND_LABEL: Readonly<Record<DeviceSummary["kind"], string>> = {
  number: "숫자",
  light: "조명",
  switch: "스위치",
  boolean: "스위치",
  fan: "팬",
  player: "플레이어",
};

const kindLabel = (kind: DeviceSummary["kind"]): string => KIND_LABEL[kind];

const mergeDevice = (current: readonly DeviceSummary[], device: DeviceSummary): DeviceSummary[] => {
  const next = current.filter((item) => item.id !== device.id);
  next.push(device);
  return next.sort((left, right) => left.name.localeCompare(right.name));
};
