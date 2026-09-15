/**
 * 배포가 active인 플로. 상태 탭 상단.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { deactivateFlow, waitDeployment, type FlowListItem } from "../lib/flows-api.js";
import { buttonRecipe } from "../ui/button.css.js";
import { caption, section, sectionTitle } from "../ui/layout.css.js";
import { empty } from "../ui/table.css.js";
import { board, tile, tileKind, tileName, tileReading, tileState } from "./device-dashboard.css.js";

export const activeFlowsOf = (flows: readonly FlowListItem[]): readonly FlowListItem[] =>
  flows.filter((flow) => flow.deploy_status === "active");

const shortId = (value: string | null) => (value ? value.slice(0, 8) : "없음");

export const ActiveFlows = (props: {
  readonly flows: readonly FlowListItem[];
  readonly siteId?: string;
  readonly csrf?: string;
  readonly onChanged?: () => void;
}) => {
  const listed = activeFlowsOf(props.flows);
  const [busyId, setBusyId] = useState<string>();
  const [error, setError] = useState<string>();
  return (
    <section className={section} data-testid="active-flows">
      <h2 className={sectionTitle}>활성 플로</h2>
      <p className={caption}>지금 배포되어 실행할 수 있는 플로입니다.</p>
      {listed.length === 0 ? (
        <p className={empty}>배포된 플로가 없습니다. 플로에서 배포하면 여기에 나타납니다.</p>
      ) : (
        <div className={board}>
          {listed.map((flow) => (
            <article key={flow.id}>
              <Link
                className={tile()}
                data-testid={`active-flow-${flow.id}`}
                to={`/flows/${flow.id}`}
              >
                <span className={tileKind}>배포</span>
                <span className={tileName}>{flow.name}</span>
                <span className={tileState({ live: true })}>active</span>
                <span className={tileReading}>{shortId(flow.revision_id)}</span>
              </Link>
              {props.siteId && props.csrf ? (
                <button
                  className={buttonRecipe()}
                  data-testid={`deactivate-flow-${flow.id}`}
                  disabled={busyId === flow.id}
                  type="button"
                  onClick={() => {
                    setBusyId(flow.id);
                    setError(undefined);
                    void deactivateFlow(props.siteId ?? "", flow.id, props.csrf ?? "")
                      .then((deployed) => waitDeployment(props.siteId ?? "", deployed.deploymentId))
                      .then(() => props.onChanged?.())
                      .catch((caught: unknown) => {
                        setError(caught instanceof Error ? caught.message : "해제 실패");
                      })
                      .finally(() => setBusyId(undefined));
                  }}
                >
                  해제
                </button>
              ) : null}
            </article>
          ))}
        </div>
      )}
      {error ? <p className={empty}>{error}</p> : null}
    </section>
  );
};
