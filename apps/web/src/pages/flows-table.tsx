/**
 * 플로 초안 표. 행에서 삭제 확인.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { loginHref, UnauthorizedError } from "../lib/api.js";
import { deleteFlow, type FlowListItem } from "../lib/flows-api.js";
import { buttonRecipe } from "../ui/button.css.js";
import { errorText } from "../ui/form.css.js";
import {
  empty,
  tableActions,
  tableCell,
  tableHead,
  tableHeadNumeric,
  tableLink,
  tableMono,
  tableStack,
  tableWrap,
} from "../ui/table.css.js";

export const FlowTable = (props: {
  readonly flows: readonly FlowListItem[];
  readonly siteId: string;
  readonly csrf: string;
  readonly onRemoved: (flowId: string) => void;
}) => {
  const [pendingId, setPendingId] = useState<string>();
  const [busyId, setBusyId] = useState<string>();
  const [error, setError] = useState<string>();

  if (props.flows.length === 0) {
    return <p className={empty}>플로가 없습니다.</p>;
  }

  const remove = (flow: FlowListItem) => {
    if (busyId) {
      return;
    }
    setBusyId(flow.id);
    setError(undefined);
    void deleteFlow(props.siteId, flow.id, props.csrf)
      .then(() => {
        setPendingId(undefined);
        props.onRemoved(flow.id);
      })
      .catch((caught: unknown) => {
        if (caught instanceof UnauthorizedError) {
          window.location.assign(loginHref);
          return;
        }
        setError(caught instanceof Error ? caught.message : "삭제하지 못했습니다.");
      })
      .finally(() => setBusyId(undefined));
  };

  return (
    <div className={tableWrap}>
      {error ? <p className={errorText}>{error}</p> : null}
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
            <th className={tableHeadNumeric} scope="col">
              삭제
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
              <td className={tableCell}>
                {pendingId === flow.id ? (
                  <div className={tableStack}>
                    {flow.deploy_status === "active" ? (
                      <p className={empty}>활성 배포도 함께 해제됩니다.</p>
                    ) : null}
                    <div className={tableActions}>
                      <button
                        className={buttonRecipe({ intent: "primary" })}
                        data-testid={`delete-flow-confirm-${flow.id}`}
                        disabled={busyId === flow.id}
                        type="button"
                        onClick={() => remove(flow)}
                      >
                        확인
                      </button>
                      <button
                        className={buttonRecipe()}
                        data-testid={`delete-flow-cancel-${flow.id}`}
                        disabled={busyId === flow.id}
                        type="button"
                        onClick={() => setPendingId(undefined)}
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={tableActions}>
                    <button
                      className={buttonRecipe()}
                      data-testid={`delete-flow-${flow.id}`}
                      type="button"
                      onClick={() => {
                        setError(undefined);
                        setPendingId(flow.id);
                      }}
                    >
                      삭제
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
