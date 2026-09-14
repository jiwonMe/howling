/**
 * Pairing code 입력과 HA 연결 상태.
 */
import { useEffect, useState } from "react";
import { loginHref, UnauthorizedError } from "../lib/api.js";
import { haStatus, runtimeDetail } from "../lib/dashboard.js";
import { pairRuntime } from "../lib/flows-api.js";
import { loadStatus, type StatusSnapshot } from "../lib/status.js";
import { buttonRecipe } from "../ui/button.css.js";
import { iconMark } from "../ui/icon.css.js";
import { Plug2Outline18 } from "../ui/icons/index.js";
import { errorText, field, formStack, input, label } from "../ui/form.css.js";
import { caption, header, page, subtitle, title } from "../ui/layout.css.js";
import { stat, statDetail, statLabel, statStrip, statValue } from "../ui/stat.css.js";

export const ConnectionsPage = () => {
  const [data, setData] = useState<StatusSnapshot>();
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const next = await loadStatus();
        if (!cancelled) {
          setData(next);
        }
      } catch (caught) {
        if (caught instanceof UnauthorizedError) {
          window.location.assign(loginHref);
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

  if (!data) {
    return (
      <div className={page({ tone: "muted" })}>
        <p>불러오는 중…</p>
      </div>
    );
  }

  const ha = haStatus(data.runtime);
  return (
    <div className={page()}>
      <header className={header}>
        <div>
          <h1 className={title}>연결</h1>
          <p className={subtitle}>{data.site.name}</p>
        </div>
      </header>
      <p className={caption}>
        Pairing code로 이 site에 로컬 runtime을 묶습니다. Home Assistant secret은 runtime에만
        있습니다.
      </p>
      <section className={statStrip({ columns: "two" })}>
        <article className={stat}>
          <p className={statLabel}>Runtime</p>
          <p className={statValue({ online: data.runtime.online })} data-testid="runtime-online">
            {data.runtime.online ? "online" : "offline"}
          </p>
          <p className={statDetail}>{runtimeDetail(data.runtime)}</p>
        </article>
        <article className={stat}>
          <p className={statLabel}>Home Assistant</p>
          <p className={statValue({ online: ha === "ready" })} data-testid="ha-status">
            {ha}
          </p>
          <p className={statDetail}>Secret은 로컬 runtime setup에만 있습니다.</p>
        </article>
      </section>
      <form
          className={formStack}
          onSubmit={(event) => {
            event.preventDefault();
            void pairRuntime(data.site.id, code, data.user.csrfToken)
              .then(() => setMessage("pairing 요청을 보냈습니다."))
              .catch((caught: unknown) => {
                setMessage(caught instanceof Error ? caught.message : "실패");
              });
          }}
        >
          <div className={field}>
            <label className={label} htmlFor="pair-code">
              Pairing code
            </label>
            <input
              id="pair-code"
              className={input}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              autoComplete="one-time-code"
            />
          </div>
          <button className={buttonRecipe({ intent: "primary" })} type="submit">
            <Plug2Outline18 aria-hidden className={iconMark} />
            연결
          </button>
          {message ? <p className={errorText}>{message}</p> : null}
        </form>
    </div>
  );
};
