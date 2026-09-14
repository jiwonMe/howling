/**
 * 로그인 후 API·runtime 연결 상태를 보여 준다.
 */
import type { RuntimeStatus } from "@howling/contracts";
import { useEffect, useState } from "react";
import { loginHref, logout, UnauthorizedError } from "../lib/api.js";
import { cn } from "../lib/cn.js";
import { loadStatus, type StatusSnapshot } from "../lib/status.js";

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
      <main className={cn(/* 오류 화면 */ "min-h-screen bg-zinc-950 p-8 text-red-300")}>
        <p>{error}</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className={cn(/* 로딩 화면 */ "min-h-screen bg-zinc-950 p-8 text-zinc-400")}>
        <p>상태를 불러오는 중…</p>
      </main>
    );
  }

  return (
    <main
      className={cn(
        /* 페이지 배경 */
        "min-h-screen bg-zinc-950 text-zinc-100",
        /* 여백 */
        "p-8",
      )}
    >
      <header
        className={cn(
          /* 헤더 정렬 */
          "mb-8 flex items-center justify-between",
        )}
      >
        <div>
          <h1 className={cn(/* 제목 */ "text-2xl font-semibold")}>Howling</h1>
          <p className={cn(/* 부제 */ "text-sm text-zinc-400")}>
            {data.user.email ?? data.user.id} · {data.site.name}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            void logout(data.user.csrfToken).then(() => {
              window.location.assign(loginHref);
            });
          }}
          className={cn(
            /* 로그아웃 버튼 */
            "rounded-md border border-zinc-700 px-3 py-1.5 text-sm",
            /* hover */
            "hover:bg-zinc-900",
          )}
        >
          로그아웃
        </button>
      </header>
      <section
        className={cn(
          /* 카드 그리드 */
          "grid gap-4 md:grid-cols-2",
        )}
      >
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
          value="not_configured"
          online={false}
          detail="단계 2에서 연결한다."
        />
      </section>
    </main>
  );
};

const runtimeDetail = (runtime: RuntimeStatus): string => {
  const seen = runtime.lastSeenAt ?? "없음";
  return `${runtime.runtimeId} · gen ${String(runtime.connectionGeneration)} · last ${seen}`;
};

const StatusCard = (props: {
  readonly title: string;
  readonly value: string;
  readonly online: boolean;
  readonly detail: string;
}) => (
  <article
    className={cn(
      /* 상태 카드 골격 */
      "rounded-xl border border-zinc-800 bg-zinc-950 p-6",
      /* 카드 간격 */
      "flex flex-col gap-3",
    )}
  >
    <h2 className={cn(/* 카드 제목 */ "text-sm uppercase tracking-wide text-zinc-500")}>
      {props.title}
    </h2>
    <p
      className={cn(
        /* runtime 온라인 강조 */
        props.online ? "text-emerald-400" : "text-zinc-400",
        /* 값 크기 */
        "text-xl font-medium",
      )}
    >
      {props.value}
    </p>
    <p className={cn(/* 부가 정보 */ "text-sm text-zinc-500")}>{props.detail}</p>
  </article>
);
