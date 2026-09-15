/**
 * 기기 현재값. 실행 목록은 로그 탭.
 */
import type { DeviceSummary } from "@howling/contracts";
import { useEffect, useState } from "react";
import { loginHref, UnauthorizedError } from "../lib/api.js";
import { getDevices } from "../lib/devices-api.js";
import { listFlows, type FlowListItem } from "../lib/flows-api.js";
import { loadStatus, type StatusSnapshot } from "../lib/status.js";
import { header, page, title } from "../ui/layout.css.js";
import { ActiveFlows } from "./active-flows.js";
import { DeviceDashboard } from "./device-dashboard.js";

export const StatusPage = () => {
  const [data, setData] = useState<StatusSnapshot>();
  const [devices, setDevices] = useState<readonly DeviceSummary[]>([]);
  const [flows, setFlows] = useState<readonly FlowListItem[]>([]);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const next = await loadStatus();
        if (!cancelled) {
          setData(next);
          setError(undefined);
        }
        const [catalog, listed] = await Promise.all([
          getDevices(next.site.id).catch(() => ({ devices: [] })),
          listFlows(next.site.id).catch(() => ({ flows: [] })),
        ]);
        if (!cancelled) {
          setDevices(catalog.devices);
          setFlows(listed.flows);
        }
      } catch (caught) {
        if (caught instanceof UnauthorizedError) {
          window.location.assign(loginHref);
          return;
        }
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "조회 실패");
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

  if (error && !data) {
    return (
      <div className={page({ tone: "error" })}>
        <p>{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={page({ tone: "muted" })}>
        <p>상태를 불러오는 중…</p>
      </div>
    );
  }

  return (
    <div className={page()}>
      <header className={header}>
        <div>
          <h1 className={title}>Howling</h1>
        </div>
      </header>
      <ActiveFlows
        csrf={data.user.csrfToken}
        flows={flows}
        siteId={data.site.id}
        onChanged={() => {
          void listFlows(data.site.id)
            .then((listed) => setFlows(listed.flows))
            .catch(() => undefined);
        }}
      />
      <DeviceDashboard
        csrf={data.user.csrfToken}
        devices={devices}
        siteId={data.site.id}
        onDevice={(device) => {
          setDevices((current) => current.map((item) => (item.id === device.id ? device : item)));
        }}
        onGone={(deviceId) => {
          setDevices((current) => current.filter((item) => item.id !== deviceId));
        }}
      />
    </div>
  );
};
