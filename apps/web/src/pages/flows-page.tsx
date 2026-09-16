/**
 * 플로 초안과 배포 상태. 실행 목록은 로그 탭.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginHref, UnauthorizedError } from "../lib/api.js";
import { createFlow, listFlows, type FlowListItem } from "../lib/flows-api.js";
import { loadStatus } from "../lib/status.js";
import { buttonRecipe } from "../ui/button.css.js";
import { iconMark } from "../ui/icon.css.js";
import { PlusOutline18 } from "../ui/icons/index.js";
import { caption, header, page, section, sectionTitle, title } from "../ui/layout.css.js";
import { FlowTable } from "./flows-table.js";

export const FlowsPage = () => {
  const navigate = useNavigate();
  const [siteId, setSiteId] = useState<string>();
  const [csrf, setCsrf] = useState<string>();
  const [flows, setFlows] = useState<FlowListItem[]>([]);

  useEffect(() => {
    void loadStatus()
      .then(async (status) => {
        setSiteId(status.site.id);
        setCsrf(status.user.csrfToken);
        const flowList = await listFlows(status.site.id);
        setFlows(flowList.flows);
      })
      .catch((caught: unknown) => {
        if (caught instanceof UnauthorizedError) {
          window.location.assign(loginHref);
        }
      });
  }, []);

  if (!siteId || !csrf) {
    return (
      <div className={page({ tone: "muted" })}>
        <p>불러오는 중…</p>
      </div>
    );
  }

  return (
    <div className={page()}>
      <header className={header}>
        <div>
          <h1 className={title}>플로</h1>
          <p className={caption}>초안과 배포 상태. 이름 옆 연필로 바꾸고, 목록에서 지울 수 있습니다.</p>
        </div>
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
          <PlusOutline18 aria-hidden className={iconMark} />
          새 플로
        </button>
      </header>
      <section className={section}>
        <h2 className={sectionTitle}>초안</h2>
        <FlowTable
          csrf={csrf}
          flows={flows}
          siteId={siteId}
          onRemoved={(flowId) => setFlows((rows) => rows.filter((row) => row.id !== flowId))}
          onRenamed={(flowId, name) =>
            setFlows((rows) => rows.map((row) => (row.id === flowId ? { ...row, name } : row)))
          }
        />
      </section>
    </div>
  );
};
