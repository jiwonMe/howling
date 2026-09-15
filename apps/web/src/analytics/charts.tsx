/**
 * CSS/SVG 차트. 라이브러리를 쓰지 않는다.
 */
import type { AnalyticsSnapshot } from "@howling/contracts";
import { caption, sectionTitle } from "../ui/layout.css.js";
import { tableCell, tableHead, tableWrap } from "../ui/table.css.js";
import { chartCard, spark } from "./charts.css.js";

export const Sparkline = (props: { readonly points: readonly { readonly value: number }[] }) => {
  if (props.points.length === 0) {
    return <p className={caption}>샘플이 없습니다</p>;
  }
  const values = props.points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const d = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * 100;
      const y = 40 - ((value - min) / span) * 36;
      return `${index === 0 ? "M" : "L"}${String(x)} ${String(y)}`;
    })
    .join(" ");
  return (
    <svg className={spark} viewBox="0 0 100 44" preserveAspectRatio="none">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
};

export const AnalyticsWidgets = (props: { readonly data: AnalyticsSnapshot }) => {
  const rate =
    props.data.runCounts.total === 0
      ? 0
      : Math.round((props.data.runCounts.succeeded / props.data.runCounts.total) * 100);
  return (
    <>
      <article className={chartCard} data-testid="chart-series">
        <h2 className={sectionTitle}>시계열</h2>
        {props.data.series.length === 0 ? (
          <p className={caption}>관측 필드를 선택하면 값이 쌓입니다</p>
        ) : (
          props.data.series.map((series) => (
            <div key={series.fieldId}>
              <p className={caption}>{series.fieldId}</p>
              <Sparkline points={series.points} />
            </div>
          ))
        )}
      </article>
      <article className={chartCard} data-testid="chart-success">
        <h2 className={sectionTitle}>실행·성공률</h2>
        <p data-testid="run-success-rate">
          {String(props.data.runCounts.succeeded)}/{String(props.data.runCounts.total)} · {String(rate)}%
        </p>
        <p className={caption}>실패 {String(props.data.runCounts.failed)}</p>
      </article>
      <article className={chartCard} data-testid="chart-nodes">
        <h2 className={sectionTitle}>노드 소요</h2>
        <DurationTable rows={props.data.nodeDurations} />
      </article>
      <article className={chartCard} data-testid="chart-errors">
        <h2 className={sectionTitle}>최근 오류</h2>
        {props.data.recentErrors.length === 0 ? (
          <p className={caption}>오류 없음</p>
        ) : (
          <ul>
            {props.data.recentErrors.map((item) => (
              <li key={`${item.runId}-${item.type}-${item.nodeId ?? ""}`}>
                {item.type} {item.nodeId ?? ""}
              </li>
            ))}
          </ul>
        )}
      </article>
    </>
  );
};

const DurationTable = (props: {
  readonly rows: AnalyticsSnapshot["nodeDurations"];
}) => (
  <div className={tableWrap}>
    <table>
      <thead>
        <tr>
          <th className={tableHead} scope="col">
            Node
          </th>
          <th className={tableHead} scope="col">
            Events
          </th>
        </tr>
      </thead>
      <tbody>
        {props.rows.map((row) => (
          <tr key={row.nodeId}>
            <td className={tableCell}>{row.nodeId}</td>
            <td className={tableCell}>{row.events}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
