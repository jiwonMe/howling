/**
 * 플로 목록과 최근 실행.
 */
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loginHref, UnauthorizedError } from "../lib/api.js";
import { createFlow, listFlows, listRuns, type FlowListItem, type RunRow } from "../lib/flows-api.js";
import { loadStatus } from "../lib/status.js";
import { buttonRecipe } from "../ui/button.css.js";
import { iconMark } from "../ui/icon.css.js";
import { PlusOutline18 } from "../ui/icons/index.js";
import { caption, header, page, section, sectionTitle, title } from "../ui/layout.css.js";
import { RunTable } from "../ui/run-table.js";
import {
  empty,
  tableCell,
  tableHead,
  tableLink,
  tableMono,
  tableWrap,
} from "../ui/table.css.js";

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
          <p className={caption}>초안과 배포 상태</p>
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
        <FlowTable flows={flows} />
      </section>
      <section className={section}>
        <h2 className={sectionTitle}>최근 실행</h2>
        <RunTable runs={runs} />
      </section>
    </div>
  );
};

const FlowTable = (props: { readonly flows: readonly FlowListItem[] }) => {
  if (props.flows.length === 0) {
    return <p className={empty}>플로가 없습니다.</p>;
  }
  return (
    <div className={tableWrap}>
      <table>
        <thead>
          <tr>
            <th className={tableHead} scope="col">
              이름
            </th>
            <th className={tableHead} scope="col">
              Revision
            </th>
            <th className={tableHead} scope="col">
              Deploy
            </th>
          </tr>
        </thead>
        <tbody>
          {props.flows.map((flow) => (
            <tr data-testid={`flow-${flow.id}`} key={flow.id}>
              <td className={tableCell}>
                <Link className={tableLink} to={`/flows/${flow.id}`}>
                  {flow.name}
                </Link>
              </td>
              <td className={`${tableCell} ${tableMono}`}>{flow.revision_id ?? "없음"}</td>
              <td className={tableCell}>{flow.deploy_status ?? "draft"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
