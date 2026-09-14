/**
 * SSE를 우선하고, 실패하면 JSON polling으로 보조한다.
 */
import { useEffect, useState } from "react";
import { loginHref, UnauthorizedError } from "../lib/api.js";
import { getRun, getRunEvents, type RunRow } from "../lib/flows-api.js";
import { loadStatus } from "../lib/status.js";

export const useRunStream = (runId: string | undefined) => {
  const [row, setRow] = useState<RunRow>();
  const [siteId, setSiteId] = useState<string>();
  const [csrf, setCsrf] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!runId) {
      return;
    }
    let cancelled = false;
    let source: EventSource | undefined;
    let timer: number | undefined;
    const apply = (next: RunRow) => {
      if (!cancelled) {
        setRow(next);
      }
    };
    const poll = async (id: string) => {
      try {
        apply(await getRun(id, runId));
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
    void loadStatus()
      .then(async (status) => {
        setSiteId(status.site.id);
        setCsrf(status.user.csrfToken);
        try {
          apply(await getRunEvents(status.site.id, runId));
        } catch {
          await poll(status.site.id);
        }
        source = new EventSource(`/api/v1/sites/${status.site.id}/runs/${runId}/events`, {
          withCredentials: true,
        });
        source.addEventListener("snapshot", (event) => {
          apply(JSON.parse(event.data) as RunRow);
        });
        source.addEventListener("summary", () => {
          void getRun(status.site.id, runId).then(apply);
        });
        void poll(status.site.id);
        timer = window.setInterval(() => {
          void poll(status.site.id);
        }, 1000);
        source.onerror = () => {
          source?.close();
          source = undefined;
        };
      })
      .catch((caught: unknown) => {
        if (caught instanceof UnauthorizedError) {
          window.location.assign(loginHref);
        }
      });
    return () => {
      cancelled = true;
      source?.close();
      if (timer) {
        window.clearInterval(timer);
      }
    };
  }, [runId]);

  return { row, siteId, csrf, error, setRow };
};
