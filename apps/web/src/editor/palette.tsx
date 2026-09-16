/**
 * 노드 팔레트. 검색으로 좁히고, 한 줄짜리 항목을 누르면 마지막 노드 뒤에 붙는다.
 */
import { officialCatalog } from "@howling/contracts";
import { useState } from "react";
import { CATEGORY_LABELS, CATEGORY_ORDER, nodeMeta, type NodeMeta } from "../lib/node-meta.js";
import { accent, tone } from "../ui/flow-node.css.js";
import { iconMark } from "../ui/icon.css.js";
import { MagnifierOutline18, XmarkOutline18 } from "../ui/icons/index.js";
import * as css from "../ui/palette.css.js";
import { NodeIcon } from "./node-icon.js";

/** 카탈로그 순서가 아니라 종류 순서(시작 → 동작)로 늘어놓는다. */
const ordered = (): readonly NodeMeta[] =>
  CATEGORY_ORDER.flatMap((category) =>
    officialCatalog
      .map((item) => nodeMeta(item.type))
      .filter((meta) => meta.category === category),
  );

const haystack = (meta: NodeMeta): string =>
  [meta.label, meta.hint, meta.type, meta.idBase, CATEGORY_LABELS[meta.category]]
    .join(" ")
    .toLowerCase();

const matches = (meta: NodeMeta, query: string): boolean => {
  const needle = query.trim().toLowerCase();
  if (needle === "") {
    return true;
  }
  const text = haystack(meta);
  return needle.split(/\s+/).every((word) => text.includes(word));
};

export const Palette = (props: {
  readonly onAdd: (type: string) => void;
  readonly hasInput: boolean;
}) => {
  const [query, setQuery] = useState("");
  const visible = ordered().filter((meta) => matches(meta, query));
  const add = (type: string) => {
    props.onAdd(type);
    setQuery("");
  };
  return (
    <aside className={css.palette} data-testid="palette" aria-label="노드 추가">
      <div className={css.searchRow}>
        <MagnifierOutline18 aria-hidden className={iconMark} />
        <input
          aria-label="노드 검색"
          className={css.searchInput}
          data-testid="palette-search"
          placeholder="노드 검색"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape" && query !== "") {
              event.preventDefault();
              setQuery("");
            } else if (event.key === "Enter" && visible[0]) {
              event.preventDefault();
              add(visible[0].type);
            }
          }}
        />
        {query !== "" ? (
          <button
            aria-label="검색 지우기"
            className={css.clearButton}
            type="button"
            onClick={() => setQuery("")}
          >
            <XmarkOutline18 aria-hidden className={iconMark} />
          </button>
        ) : null}
      </div>
      <div className={css.list}>
        {visible.map((meta) => (
          <button
            key={meta.type}
            className={css.item}
            data-testid={`palette-${meta.type}`}
            title={`${meta.label} — ${meta.hint}`}
            type="button"
            onClick={() => add(meta.type)}
          >
            <span className={`${css.itemIcon} ${tone[meta.category]}`} style={{ color: accent }}>
              <NodeIcon type={meta.type} />
            </span>
            <span className={css.itemLabel}>{meta.label}</span>
            <span className={css.itemTag}>{CATEGORY_LABELS[meta.category]}</span>
          </button>
        ))}
        {visible.length === 0 ? <p className={css.footNote}>「{query.trim()}」에 맞는 노드가 없습니다.</p> : null}
      </div>
      {!props.hasInput && visible.length > 0 ? (
        <p className={css.footNote}>「입력」부터 시작하세요.</p>
      ) : null}
    </aside>
  );
};
