/**
 * 실행 상세. SSE가 우선이고 polling은 보조다.
 */
import { RunControls } from "../run/run-controls.js";
import { useRunStream } from "../run/use-run-stream.js";
import { useParams } from "react-router-dom";
import { useState } from "react";
import { caption, header, page, section, sectionTitle, subtitle, title } from "../ui/layout.css.js";
import { stat, statDetail, statLabel, statStrip, statValue } from "../ui/stat.css.js";
import { tableCell, tableHead, tableHeadNumeric, tableCellNumeric, tableMono, tableWrap } from "../ui/table.css.js";
import type { RunRow } from "../lib/flows-api.js";

export const RunPage = () => {
  const { runId } = useParams<{ runId: string }>();
  const { row, siteId, csrf, error } = useRunStream(runId);
  const [message, setMessage] = useState<string>();

  if (error && !row) {
    return (
      <div className={page({ tone: "error" })}>
        <p>{error}</p>
      </div>
    );
  }

  if (!row) {
    return (
      <div className={page({ tone: "muted" })}>
        <p>실행을 불러오는 중…</p>
      </div>
    );
  }

  return (
    <div className={page()}>
      <header className={header}>
        <div>
          <h1 className={title}>실행</h1>
          <p className={subtitle} data-testid="run-id">
            {row.runId}
          </p>
        </div>
        {row.runMode === "dryRun" ? <p data-testid="dry-run-badge">시험</p> : null}
      </header>
      {siteId && csrf ? (
        <RunControls csrf={csrf} onMessage={setMessage} row={row} siteId={siteId} />
      ) : null}
      {message ? <p className={caption}>{message}</p> : null}
      <section className={statStrip()}>
        <article className={stat}>
          <p className={statLabel}>Status</p>
          <p className={statValue({ online: row.status === "completed" })} data-testid="run-status">
            {row.status}
          </p>
        </article>
        <article className={stat}>
          <p className={statLabel}>Revision</p>
          <p className={statDetail} data-testid="run-revision">
            revision {row.revisionId}
          </p>
        </article>
        <article className={stat}>
          <p className={statLabel}>lastSeq</p>
          <p className={statDetail}>{row.lastSeq}</p>
        </article>
      </section>
      <p className={caption} data-testid="run-trigger">
        {JSON.stringify(row.trigger)}
      </p>
      <section className={section}>
        <h2 className={sectionTitle}>이벤트</h2>
        <EventTable events={row.events} />
      </section>
    </div>
  );
};

const EventTable = (props: { readonly events: RunRow["events"] }) => (
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
        </tr>
      </thead>
      <tbody>
        {props.events.map((event) => (
          <tr key={event.sequence}>
            <td className={tableCellNumeric}>{event.sequence}</td>
            <td className={`${tableCell} ${tableMono}`}>{event.type}</td>
            <td className={`${tableCell} ${tableMono}`}>{event.nodeId ?? ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
