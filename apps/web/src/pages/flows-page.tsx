/**
 * 플로 목록과 생성.
 */
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loginHref, UnauthorizedError } from "../lib/api.js";
import { createFlow, listFlows, listRuns, type FlowListItem, type RunRow } from "../lib/flows-api.js";
import { loadStatus } from "../lib/status.js";
import { themeClass } from "../styles/theme.css.js";
import { buttonRecipe } from "../ui/button.css.js";
import { card, cardDetail, cardTitle } from "../ui/card.css.js";
import { list } from "../ui/editor.css.js";
import { header, page, subtitle, title } from "../ui/layout.css.js";

export const FlowsPage = () => {
  const navigate = useNavigate();
  const [siteId, setSiteId] = useState<string>();
  const [csrf, setCsrf] = useState<string>();
  const [flows, setFlows] = useState<FlowListItem[]>([]);
  const [runs, setRuns] = useState<RunRow[]>([]);

  useEffect(() => {
    void loadStatus()
      .then(async (status) => {
        setSiteId(status.site.id);
        setCsrf(status.user.csrfToken);
        const [flowList, runList] = await Promise.all([
          listFlows(status.site.id),
          listRuns(status.site.id),
        ]);
        setFlows(flowList.flows);
        setRuns(runList.runs);
      })
      .catch((caught: unknown) => {
        if (caught instanceof UnauthorizedError) {
          window.location.assign(loginHref);
        }
      });
  }, []);

  if (!siteId || !csrf) {
    return (
      <main className={`${themeClass} ${page({ tone: "muted" })}`}>
        <p>불러오는 중…</p>
      </main>
    );
  }

  return (
    <main className={`${themeClass} ${page()}`}>
      <header className={header}>
        <div>
          <h1 className={title}>플로</h1>
          <p className={subtitle}>초안과 배포 상태</p>
        </div>
        <div>
          <Link className={buttonRecipe()} to="/">
            상태
          </Link>{" "}
          <button
            className={buttonRecipe({ intent: "primary" })}
            data-testid="create-flow"
            type="button"
            onClick={() => {
              void createFlow(siteId, "Power alert", csrf).then((created) =>
                navigate(`/flows/${created.flowId}`),
              );
            }}
          >
            새 플로
          </button>
        </div>
      </header>
      <section className={list}>
        {flows.map((flow) => (
          <article className={card} key={flow.id} data-testid={`flow-${flow.id}`}>
            <h2 className={cardTitle}>{flow.name}</h2>
            <p className={cardDetail}>
              revision {flow.revision_id ?? "없음"} · {flow.deploy_status ?? "draft"}
            </p>
            <Link className={buttonRecipe()} to={`/flows/${flow.id}`}>
              편집
            </Link>
          </article>
        ))}
      </section>
      <section className={list}>
        <h2 className={cardTitle}>최근 실행</h2>
        {runs.map((run) => (
          <article className={card} key={run.runId} data-testid={`run-link-${run.runId}`}>
            <p className={cardDetail}>
              {run.runId} · {run.status} · rev {run.revisionId}
            </p>
            <Link className={buttonRecipe()} to={`/runs/${run.runId}`}>
              상세
            </Link>
          </article>
        ))}
      </section>
    </main>
  );
};
