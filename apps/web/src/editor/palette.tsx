/**
 * 공식 노드 팔레트.
 */
import { officialCatalog } from "@howling/contracts";
import { buttonRecipe } from "../ui/button.css.js";
import { cardTitle } from "../ui/card.css.js";
import { palette } from "../ui/editor.css.js";

export const Palette = (props: { readonly onAdd: (type: string) => void }) => (
  <aside className={palette} data-testid="palette">
    <h2 className={cardTitle}>노드</h2>
    {officialCatalog.map((node) => (
      <button
        key={node.type}
        type="button"
        className={buttonRecipe()}
        data-testid={`palette-${node.type}`}
        onClick={() => props.onAdd(node.type)}
      >
        {node.title}
      </button>
    ))}
  </aside>
);
