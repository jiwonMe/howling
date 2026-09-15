/**
 * 공식 관측 화면.
 */
import type { ObservationField } from "@howling/contracts";
import { useEffect, useState } from "react";
import { loginHref, UnauthorizedError } from "../lib/api.js";
import { getAnalytics, getObservations, putObservations } from "../lib/data-api.js";
import { loadStatus } from "../lib/status.js";
import { buttonRecipe } from "../ui/button.css.js";
import { errorText, field, formStack, input, label } from "../ui/form.css.js";
import { caption, header, page, section, subtitle, title } from "../ui/layout.css.js";
import { AnalyticsWidgets } from "./charts.js";
import { chartGrid } from "./charts.css.js";
import type { AnalyticsSnapshot } from "@howling/contracts";

export const AnalyticsPage = () => {
  const [siteId, setSiteId] = useState<string>();
  const [csrf, setCsrf] = useState<string>();
  const [data, setData] = useState<AnalyticsSnapshot>();
  const [fields, setFields] = useState<ObservationField[]>([]);
  const [draft, setDraft] = useState({ id: "power", flowId: "", nodeId: "input", pointer: "/value/power" });
  const [message, setMessage] = useState<string>();
  const [resync, setResync] = useState(false);

  useEffect(() => {
    void loadStatus()
      .then(async (status) => {
        setSiteId(status.site.id);
        setCsrf(status.user.csrfToken);
        const empty = {
          series: [],
          runCounts: { total: 0, succeeded: 0, failed: 0 },
          nodeDurations: [],
          recentErrors: [],
        };
        const [analytics, observations] = await Promise.all([
          getAnalytics(status.site.id).catch((error: unknown) => {
            if (error instanceof Error && error.message.includes("409")) {
              setResync(true);
            }
            setMessage(error instanceof Error ? error.message : "관측을 불러오지 못했습니다.");
            return empty;
          }),
          getObservations(status.site.id).catch(() => ({ observations: { fields: [] } })),
        ]);
        setData(analytics);
        setFields(observations.observations.fields);
        setDraft((current) => ({ ...current, flowId: current.flowId || "" }));
      })
      .catch((caught: unknown) => {
        if (caught instanceof UnauthorizedError) {
          window.location.assign(loginHref);
        }
      });
  }, []);

  if (!siteId || !csrf || !data) {
    return (
      <div className={page({ tone: "muted" })}>
        <p>관측을 불러오는 중…</p>
      </div>
    );
  }

  return (
    <div className={page()}>
      <header className={header}>
        <div>
          <h1 className={title}>관측</h1>
          <p className={subtitle}>선택한 필드의 숫자만 모읍니다. 원문 payload는 없습니다.</p>
        </div>
      </header>
      {resync ? <p className={errorText}>수집 공백이 있습니다. 최신 구간을 다시 불러오세요.</p> : null}
      <section className={section}>
        <form
          className={formStack}
          onSubmit={(event) => {
            event.preventDefault();
            const next = draft.flowId
              ? [...fields.filter((item) => item.id !== draft.id), draft]
              : fields;
            void putObservations(siteId, csrf, { fields: next })
              .then((result) => {
                setFields(result.observations.fields);
                setMessage("관측 필드를 저장했습니다.");
              })
              .catch((caught: unknown) => {
                setMessage(caught instanceof Error ? caught.message : "실패");
              });
          }}
        >
          <div className={field}>
            <label className={label} htmlFor="obs-flow">
              Flow ID
            </label>
            <input
              id="obs-flow"
              className={input}
              data-testid="obs-flow"
              value={draft.flowId}
              onChange={(event) => setDraft({ ...draft, flowId: event.target.value })}
            />
          </div>
          <div className={field}>
            <label className={label} htmlFor="obs-node">
              Node
            </label>
            <input
              id="obs-node"
              className={input}
              data-testid="obs-node"
              value={draft.nodeId}
              onChange={(event) => setDraft({ ...draft, nodeId: event.target.value })}
            />
          </div>
          <div className={field}>
            <label className={label} htmlFor="obs-pointer">
              JSON Pointer
            </label>
            <input
              id="obs-pointer"
              className={input}
              data-testid="obs-pointer"
              value={draft.pointer}
              onChange={(event) => setDraft({ ...draft, pointer: event.target.value })}
            />
          </div>
          <button className={buttonRecipe({ intent: "primary" })} data-testid="save-observation" type="submit">
            관측 필드 저장
          </button>
        </form>
        <p className={caption}>필드 {String(fields.length)}개</p>
        {message ? <p className={caption}>{message}</p> : null}
      </section>
      <section className={chartGrid}>
        <AnalyticsWidgets data={data} />
      </section>
    </div>
  );
};
