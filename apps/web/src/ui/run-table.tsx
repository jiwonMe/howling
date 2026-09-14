/**
 * 실행 목록. 행 전체가 같은 열을 공유한다.
 */
import { Link } from "react-router-dom";
import type { RunRow } from "../lib/flows-api.js";
import { empty } from "./table.css.js";
import {
  tableCell,
  tableHead,
  tableLink,
  tableMono,
  tableWrap,
} from "./table.css.js";

export const RunTable = (props: { readonly runs: readonly RunRow[] }) => {
  if (props.runs.length === 0) {
    return <p className={empty}>실행이 없습니다.</p>;
  }
  return (
    <div className={tableWrap}>
      <table>
        <thead>
          <tr>
            <th className={tableHead} scope="col">
              Run
            </th>
            <th className={tableHead} scope="col">
              Status
            </th>
            <th className={tableHead} scope="col">
              Revision
            </th>
          </tr>
        </thead>
        <tbody>
          {props.runs.map((run) => (
            <tr data-testid={`run-link-${run.runId}`} key={run.runId}>
              <td className={`${tableCell} ${tableMono}`}>
                <Link className={tableLink} to={`/runs/${run.runId}`}>
                  {run.runId}
                </Link>
              </td>
              <td className={tableCell}>{run.status}</td>
              <td className={`${tableCell} ${tableMono}`}>{run.revisionId}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
