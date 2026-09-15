/**
 * 사이트 준비 상태와 기기 현재값.
 */
import type { DeviceSummary } from "@howling/contracts";
import { useEffect, useState } from "react";
import { loginHref, UnauthorizedError } from "../lib/api.js";
import { haStatus, runtimeDetail, siteClaim } from "../lib/dashboard.js";
import { getDevices } from "../lib/devices-api.js";
import { listRuns, type RunRow } from "../lib/flows-api.js";
import { loadStatus, type StatusSnapshot } from "../lib/status.js";
import { caption, header, lede, page, section, sectionTitle, title } from "../ui/layout.css.js";
import { RunTable } from "../ui/run-table.js";
import { stat, statDetail, statLabel, statStrip, statValue } from "../ui/stat.css.js";
import { DeviceDashboard } from "./device-dashboard.js";

export const StatusPage = () => {
  const [data, setData] = useState<StatusSnapshot>();
  const [runs, setRuns] = useState<readonly RunRow[]>([]);
  const [devices, setDevices] = useState<readonly DeviceSummary[]>([]);
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
        const [listed, catalog] = await Promise.all([
          listRuns(next.site.id),
          getDevices(next.site.id).catch(() => ({ devices: [] })),
        ]);
        if (!cancelled) {
          setRuns(listed.runs);
          setDevices(catalog.devices);
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

  const claim = siteClaim(data);
  const ha = haStatus(data.runtime);
  return (
    <div className={page()}>
      <header className={header}>
        <div>
          <h1 className={title}>Howling</h1>
        </div>
      </header>
      <p className={lede}>{claim.title}</p>
      <p className={caption}>{claim.detail}</p>
      <section className={statStrip()}>
        <article className={stat}>
          <p className={statLabel}>API</p>
          <p className={statValue({ online: data.ready.status === "ready" })}>
            {data.ready.status === "ready" ? "ready" : "not_ready"}
          </p>
          <p className={statDetail}>
            health {data.health.status} · db {data.ready.checks.database ? "ok" : "down"}
          </p>
        </article>
        <article className={stat}>
          <p className={statLabel}>Runtime</p>
          <p className={statValue({ online: data.runtime.online })}>
            {data.runtime.online ? "online" : "offline"}
          </p>
          <p className={statDetail}>{runtimeDetail(data.runtime)}</p>
        </article>
        <article className={stat}>
          <p className={statLabel}>허브</p>
          <p className={statValue({ online: ha === "ready" })}>{ha}</p>
          <p className={statDetail}>
            {ha === "not_configured" ? "local setup only" : `허브 ${ha}`}
          </p>
        </article>
      </section>
      <DeviceDashboard
        csrf={data.user.csrfToken}
        devices={devices}
        siteId={data.site.id}
        onDevice={(device) => {
          setDevices((current) => current.map((item) => (item.id === device.id ? device : item)));
        }}
      />
      <section className={section}>
        <h2 className={sectionTitle}>최근 실행</h2>
        <RunTable runs={runs} />
      </section>
    </div>
  );
};
