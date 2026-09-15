/**
 * 플로 실행 목록. 상태·플로 화면에는 두지 않는다.
 */
import { useEffect, useState } from "react";
import { loginHref, UnauthorizedError } from "../lib/api.js";
import { listRuns, type RunRow } from "../lib/flows-api.js";
import { loadStatus } from "../lib/status.js";
import { caption, header, page, title } from "../ui/layout.css.js";
import { RunTable } from "../ui/run-table.js";

export const LogsPage = () => {
  const [runs, setRuns] = useState<readonly RunRow[]>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const status = await loadStatus();
        const listed = await listRuns(status.site.id);
        if (!cancelled) {
          setRuns(listed.runs);
          setError(undefined);
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

  if (error && !runs) {
    return (
      <div className={page({ tone: "error" })}>
        <p>{error}</p>
      </div>
    );
  }

  if (!runs) {
    return (
      <div className={page({ tone: "muted" })}>
        <p>실행을 불러오는 중…</p>
      </div>
    );
  }

  return (
    <div className={page()} data-testid="logs-page">
      <header className={header}>
        <div>
          <h1 className={title}>로그</h1>
          <p className={caption}>플로 실행 기록</p>
        </div>
      </header>
      <RunTable runs={runs} />
    </div>
  );
};
