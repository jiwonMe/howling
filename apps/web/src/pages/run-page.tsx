/**
 * 실행 상세. 5초 polling.
 */
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { loginHref, UnauthorizedError } from "../lib/api.js";
import { getRun, type RunRow } from "../lib/flows-api.js";
import { loadStatus } from "../lib/status.js";
import { themeClass } from "../styles/theme.css.js";
import { buttonRecipe } from "../ui/button.css.js";
import { card, cardDetail, cardTitle } from "../ui/card.css.js";
import { list } from "../ui/editor.css.js";
import { header, page, subtitle, title } from "../ui/layout.css.js";

export const RunPage = () => {
  const { runId } = useParams<{ runId: string }>();
  const [row, setRow] = useState<RunRow>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!runId) {
      return;
    }
    let cancelled = false;
    const refresh = async () => {
      try {
        const status = await loadStatus();
        const next = await getRun(status.site.id, runId);
        if (!cancelled) {
          setRow(next);
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
  }, [runId]);

  if (error && !row) {
    return (
      <main className={`${themeClass} ${page({ tone: "error" })}`}>
        <p>{error}</p>
      </main>
    );
  }

  if (!row) {
    return (
      <main className={`${themeClass} ${page({ tone: "muted" })}`}>
        <p>실행을 불러오는 중…</p>
      </main>
    );
  }

  return (
    <main className={`${themeClass} ${page()}`}>
      <header className={header}>
        <div>
          <h1 className={title}>실행</h1>
          <p className={subtitle} data-testid="run-id">
            {row.runId}
          </p>
        </div>
        <Link className={buttonRecipe()} to="/flows">
          플로
        </Link>
      </header>
      <article className={card}>
        <h2 className={cardTitle}>요약</h2>
        <p className={cardDetail} data-testid="run-status">
          {row.status}
        </p>
        <p className={cardDetail} data-testid="run-revision">
          revision {row.revisionId}
        </p>
        <p className={cardDetail}>lastSeq {row.lastSeq}</p>
        <pre className={cardDetail} data-testid="run-trigger">
          {JSON.stringify(row.trigger)}
        </pre>
      </article>
      <section className={list}>
        {row.events.map((event) => (
          <article className={card} key={event.sequence}>
            <p className={cardDetail}>
              {event.sequence} {event.type} {event.nodeId ?? ""}
            </p>
          </article>
        ))}
      </section>
    </main>
  );
};
