/**
 * 노드 팔레트. 종류별로 묶고, 이름 아래에 한 줄 설명을 둔다.
 */
import { officialCatalog } from "@howling/contracts";
import { CATEGORY_LABELS, CATEGORY_ORDER, nodeMeta, type NodeCategory } from "../lib/node-meta.js";
import { cardTitle } from "../ui/card.css.js";
import {
  muted,
  palette,
  paletteGroup,
  paletteGroupTitle,
  paletteHint,
  paletteIcon,
  paletteItem,
  paletteLabel,
  paletteText,
} from "../ui/editor.css.js";
import { accent, tone } from "../ui/flow-node.css.js";
import { NodeIcon } from "./node-icon.js";

const grouped = (): readonly { category: NodeCategory; types: readonly string[] }[] =>
  CATEGORY_ORDER.map((category) => ({
    category,
    types: officialCatalog
      .map((item) => item.type)
      .filter((type) => nodeMeta(type).category === category),
  })).filter((group) => group.types.length > 0);

export const Palette = (props: {
  readonly onAdd: (type: string) => void;
  readonly hasInput: boolean;
}) => (
  <aside className={palette} data-testid="palette">
    <h2 className={cardTitle}>노드 추가</h2>
    <p className={muted}>
      {props.hasInput ? "누르면 마지막 노드 뒤에 이어집니다." : "「입력」부터 시작하세요."}
    </p>
    {grouped().map((group) => (
      <div key={group.category} className={paletteGroup}>
        <span className={paletteGroupTitle}>{CATEGORY_LABELS[group.category]}</span>
        {group.types.map((type) => {
          const meta = nodeMeta(type);
          return (
            <button
              key={type}
              type="button"
              className={paletteItem}
              data-testid={`palette-${type}`}
              title={`${meta.label} — ${meta.hint}`}
              onClick={() => props.onAdd(type)}
            >
              <span className={`${paletteIcon} ${tone[meta.category]}`} style={{ color: accent }}>
                <NodeIcon type={type} />
              </span>
              <span className={paletteText}>
                <span className={paletteLabel}>{meta.label}</span>
                <span className={paletteHint}>{meta.hint}</span>
              </span>
            </button>
          );
        })}
      </div>
    ))}
  </aside>
);
