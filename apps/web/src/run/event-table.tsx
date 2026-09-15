/**
 * skip/wait/unknown을 구분하고 원본 상세를 요청한다.
 */
import { useState } from "react";
import { requestRunDetail } from "../lib/data-api.js";
import type { RunRow } from "../lib/flows-api.js";
import { buttonRecipe } from "../ui/button.css.js";
import { caption } from "../ui/layout.css.js";
import { field, input, label } from "../ui/form.css.js";
import { tableCell, tableHead, tableHeadNumeric, tableCellNumeric, tableMono, tableWrap } from "../ui/table.css.js";

const kindOf = (type: string): string => {
  if (type.includes("skipped") || type.includes("skip")) {
    return "skip";
  }
  if (type.includes("waiting") || type.includes("paused")) {
    return "wait";
  }
  if (type.includes("unknown")) {
    return "unknown";
  }
  if (type.includes("failed")) {
    return "error";
  }
  return "ok";
};

export const EventTable = (props: {
  readonly events: RunRow["events"];
  readonly siteId?: string;
  readonly runId: string;
  readonly csrf?: string;
}) => {
  const [nodeId, setNodeId] = useState(props.events.find((item) => item.nodeId)?.nodeId ?? "");
  const [detail, setDetail] = useState<string>();
  return (
    <>
      <div className={tableWrap}>
        <table>
          <thead>
            <tr>
              <th className={tableHeadNumeric} scope="col">
                Seq
              </th>
              <th className={tableHead} scope="col">
                Type
              </th>
              <th className={tableHead} scope="col">
                Node
              </th>
              <th className={tableHead} scope="col">
                Kind
              </th>
            </tr>
          </thead>
          <tbody>
            {props.events.map((event) => (
              <tr key={event.sequence}>
                <td className={tableCellNumeric}>{event.sequence}</td>
                <td className={`${tableCell} ${tableMono}`}>{event.type}</td>
                <td className={`${tableCell} ${tableMono}`}>{event.nodeId ?? ""}</td>
                <td className={tableCell} data-testid={`event-kind-${String(event.sequence)}`}>
                  {kindOf(event.type)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {props.siteId && props.csrf ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void requestRunDetail(props.siteId ?? "", props.runId, props.csrf ?? "", {
              nodeId,
              field: "/value/power",
            })
              .then((result) => setDetail(JSON.stringify(result.value ?? result)))
              .catch((caught: unknown) => {
                setDetail(caught instanceof Error ? caught.message : "unavailable");
              });
          }}
        >
          <div className={field}>
            <label className={label} htmlFor="detail-node">
              원본 노드
            </label>
            <input
              id="detail-node"
              className={input}
              data-testid="detail-node"
              value={nodeId}
              onChange={(event) => setNodeId(event.target.value)}
            />
          </div>
          <button className={buttonRecipe()} data-testid="request-detail" type="submit">
            원본 상세
          </button>
        </form>
      ) : null}
      {detail ? (
        <p className={caption} data-testid="detail-result">
          {detail}
        </p>
      ) : null}
    </>
  );
};
