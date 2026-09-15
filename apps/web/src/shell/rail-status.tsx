/**
 * 레일 하단의 API·Runtime·허브 한 줄 요약.
 */
import { railStatesOf } from "../lib/dashboard.js";
import type { StatusSnapshot } from "../lib/status.js";
import { railDot, railStatus, railStatusRow, railStatusValue } from "../ui/shell.css.js";

export const RailStatus = ({ data }: { readonly data: StatusSnapshot }) => (
  <section aria-label="연결 상태" className={railStatus} data-testid="rail-status">
    {railStatesOf(data).map((item) => (
      <p
        className={railStatusRow}
        data-ok={item.ok ? "true" : "false"}
        data-testid={`rail-${item.key}`}
        key={item.key}
        title={`${item.label} ${item.value}`}
      >
        <span aria-hidden className={railDot({ ok: item.ok })} />
        <span>{item.label}</span>
        <span className={railStatusValue({ ok: item.ok })}>{item.value}</span>
      </p>
    ))}
  </section>
);
