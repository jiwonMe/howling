/**
 * 사이트 준비 상태와 최근 실행.
 */
import { useEffect, useState } from "react";
import { loginHref, UnauthorizedError } from "../lib/api.js";
import { haStatus, runtimeDetail, siteClaim } from "../lib/dashboard.js";
import { listRuns, type RunRow } from "../lib/flows-api.js";
import { loadStatus, type StatusSnapshot } from "../lib/status.js";
import { caption, header, lede, page, section, sectionTitle, title } from "../ui/layout.css.js";
import { RunTable } from "../ui/run-table.js";
import { stat, statDetail, statLabel, statStrip, statValue } from "../ui/stat.css.js";

export const StatusPage = () => {
  const [data, setData] = useState<StatusSnapshot>();
  const [runs, setRuns] = useState<readonly RunRow[]>([]);
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
        const listed = await listRuns(next.site.id);
        if (!cancelled) {
          setRuns(listed.runs);
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
      <section className={section}>
        <h2 className={sectionTitle}>최근 실행</h2>
        <RunTable runs={runs} />
      </section>
    </div>
  );
};
