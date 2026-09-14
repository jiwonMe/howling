/**
 * 로그인 후 API·runtime 연결 상태를 보여 준다.
 */
import type { RuntimeStatus } from "@howling/contracts";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { loginHref, logout, UnauthorizedError } from "../lib/api.js";
import { loadStatus, type StatusSnapshot } from "../lib/status.js";
import { themeClass } from "../styles/theme.css.js";
import { buttonRecipe } from "../ui/button.css.js";
import { card, cardDetail, cardTitle, cardValue } from "../ui/card.css.js";
import { cardGrid, header, page, subtitle, title } from "../ui/layout.css.js";

export const StatusPage = () => {
  const [data, setData] = useState<StatusSnapshot | undefined>();
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const next = await loadStatus();
        if (!cancelled) {
          setData(next);
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

  if (error && !data) {
    return (
      <main className={`${themeClass} ${page({ tone: "error" })}`}>
        <p>{error}</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className={`${themeClass} ${page({ tone: "muted" })}`}>
        <p>상태를 불러오는 중…</p>
      </main>
    );
  }

  return (
    <main className={`${themeClass} ${page()}`}>
      <header className={header}>
        <div>
          <h1 className={title}>Howling</h1>
          <p className={subtitle}>
            {data.user.email ?? data.user.id} · {data.site.name}
          </p>
        </div>
        <div>
          <Link className={buttonRecipe()} to="/connections">
            연결
          </Link>{" "}
          <Link className={buttonRecipe()} to="/flows">
            플로
          </Link>{" "}
          <button
            type="button"
            className={buttonRecipe()}
            onClick={() => {
              void logout(data.user.csrfToken).then(() => {
                window.location.assign(loginHref);
              });
            }}
          >
            로그아웃
          </button>
        </div>
      </header>
      <section className={cardGrid}>
        <StatusCard
          title="API"
          value={data.ready.status === "ready" ? "ready" : "not_ready"}
          online={data.ready.status === "ready"}
          detail={`health ${data.health.status} · db ${data.ready.checks.database ? "ok" : "down"}`}
        />
        <StatusCard
          title="Runtime"
          value={data.runtime.online ? "online" : "offline"}
          online={data.runtime.online}
          detail={runtimeDetail(data.runtime)}
        />
        <StatusCard
          title="Home Assistant"
          value={haLabel(data.runtime)}
          online={haOnline(data.runtime)}
          detail={haDetail(data.runtime)}
        />
      </section>
    </main>
  );
};

const runtimeDetail = (runtime: RuntimeStatus): string => {
  const seen = runtime.lastSeenAt ?? "없음";
  return `${runtime.runtimeId} · gen ${String(runtime.connectionGeneration)} · last ${seen}`;
};

const haLabel = (runtime: RuntimeStatus): string => {
  if (!("ha" in runtime) || !runtime.ha || typeof runtime.ha !== "object") {
    return "not_configured";
  }
  const ha = runtime.ha as { status?: string };
  return ha.status ?? "not_configured";
};

const haOnline = (runtime: RuntimeStatus): boolean => haLabel(runtime) === "ready";

const haDetail = (runtime: RuntimeStatus): string => {
  const status = haLabel(runtime);
  if (status === "not_configured") {
    return "로컬 setup에서 HA를 연결한다.";
  }
  return `HA ${status}`;
};

const StatusCard = (props: {
  readonly title: string;
  readonly value: string;
  readonly online: boolean;
  readonly detail: string;
}) => (
  <article className={card}>
    <h2 className={cardTitle}>{props.title}</h2>
    <p className={cardValue({ online: props.online })}>{props.value}</p>
    <p className={cardDetail}>{props.detail}</p>
  </article>
);
