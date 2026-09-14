/**
 * Pairing code 입력과 HA 연결 상태.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { loginHref, UnauthorizedError } from "../lib/api.js";
import { pairRuntime } from "../lib/flows-api.js";
import { loadStatus, type StatusSnapshot } from "../lib/status.js";
import { themeClass } from "../styles/theme.css.js";
import { buttonRecipe } from "../ui/button.css.js";
import { card, cardDetail, cardTitle, cardValue } from "../ui/card.css.js";
import { errorText, field, formStack, input, label } from "../ui/form.css.js";
import { header, page, subtitle, title } from "../ui/layout.css.js";

export const ConnectionsPage = () => {
  const [data, setData] = useState<StatusSnapshot | undefined>();
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | undefined>();

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
      <main className={`${themeClass} ${page({ tone: "muted" })}`}>
        <p>불러오는 중…</p>
      </main>
    );
  }

  const ha =
    data.runtime.ha && typeof data.runtime.ha === "object"
      ? (data.runtime.ha as { status?: string })
      : { status: "not_configured" };

  return (
    <main className={`${themeClass} ${page()}`}>
      <header className={header}>
        <div>
          <h1 className={title}>연결</h1>
          <p className={subtitle}>{data.site.name}</p>
        </div>
        <Link className={buttonRecipe()} to="/">
          상태
        </Link>
      </header>
      <article className={card}>
        <h2 className={cardTitle}>Runtime</h2>
        <p className={cardValue({ online: data.runtime.online })} data-testid="runtime-online">
          {data.runtime.online ? "online" : "offline"}
        </p>
        <p className={cardDetail}>{data.runtime.runtimeId}</p>
      </article>
      <article className={card}>
        <h2 className={cardTitle}>Home Assistant</h2>
        <p className={cardValue({ online: ha.status === "ready" })} data-testid="ha-status">
          {ha.status ?? "not_configured"}
        </p>
        <p className={cardDetail}>Secret은 로컬 runtime setup에만 있습니다.</p>
      </article>
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
          연결
        </button>
        {message ? <p className={errorText}>{message}</p> : null}
      </form>
    </main>
  );
};
