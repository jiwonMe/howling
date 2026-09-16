/**
 * 오른쪽 패널. 선택 없으면 플로 설정, 있으면 그 노드·연결만.
 */
import type { DeviceSummary, TriggerBinding } from "@howling/contracts";
import type { WorkflowDefinition } from "@howling/core";
import { nodeMeta, portLabel } from "../lib/node-meta.js";
import { buttonRecipe } from "../ui/button.css.js";
import { cardTitle } from "../ui/card.css.js";
import {
  dangerButton,
  muted,
  panelHead,
  panelMono,
  panelSection,
  panelTitleRow,
  sidebar,
} from "../ui/editor.css.js";
import { accent, iconWrap, tone } from "../ui/flow-node.css.js";
import { iconMark } from "../ui/icon.css.js";
import { TrashOutline18 } from "../ui/icons/index.js";
import type { McpToolOption } from "./effect-fields.js";
import { NodeFields } from "./node-fields.js";
import { NodeIcon } from "./node-icon.js";
import { TestPanel } from "./test-panel.js";
import { TriggerFields } from "./trigger-fields.js";

type NodeInstance = WorkflowDefinition["nodes"][number];

export const Bindings = (props: {
  readonly definition: WorkflowDefinition;
  readonly selectedId: string | undefined;
  readonly selectedEdgeId: string | undefined;
  readonly triggers: readonly TriggerBinding[];
  readonly onNode: (node: NodeInstance) => void;
  readonly onDefinition: (definition: WorkflowDefinition) => void;
  readonly onClearSelection: () => void;
  readonly onDeleteNode: (id: string) => void;
  readonly onDeleteEdge: (id: string) => void;
  readonly onTriggers: (triggers: readonly TriggerBinding[]) => void;
  readonly testPower: string;
  readonly onTestPower: (value: string) => void;
  readonly tools: readonly McpToolOption[];
  readonly devices: readonly DeviceSummary[];
}) => {
  const node = props.definition.nodes.find((item) => item.id === props.selectedId);
  const edge = props.definition.edges.find((item) => item.id === props.selectedEdgeId);
  const inputId = props.definition.nodes.find((item) => item.type === "core.input")?.id ?? "input";
  return (
    <aside className={sidebar}>
      {node ? (
        <section className={panelSection} data-testid="node-panel">
          <button
            className={buttonRecipe()}
            data-testid="flow-settings"
            type="button"
            onClick={props.onClearSelection}
          >
            플로 설정
          </button>
          <NodeHeader node={node} />
          <NodeFields
            definition={props.definition}
            devices={props.devices}
            inputId={inputId}
            node={node}
            onDefinition={props.onDefinition}
            onNode={props.onNode}
            tools={props.tools}
          />
          <button
            className={`${buttonRecipe()} ${dangerButton}`}
            data-testid="delete-node"
            type="button"
            onClick={() => props.onDeleteNode(node.id)}
          >
            <TrashOutline18 aria-hidden className={iconMark} />
            이 노드 삭제
          </button>
        </section>
      ) : edge ? (
        <section className={panelSection} data-testid="edge-panel">
          <button
            className={buttonRecipe()}
            data-testid="flow-settings"
            type="button"
            onClick={props.onClearSelection}
          >
            플로 설정
          </button>
          <div className={panelHead}>
            <h2 className={cardTitle}>연결</h2>
            <span className={panelMono}>
              {edge.source.nodeId} · {portLabel(edge.source.port)} → {edge.target.nodeId} ·{" "}
              {portLabel(edge.target.port)}
            </span>
          </div>
          <p className={muted}>앞 노드가 끝나면 이 선을 따라 다음 노드로 갑니다.</p>
          <button
            className={`${buttonRecipe()} ${dangerButton}`}
            data-testid="delete-edge"
            type="button"
            onClick={() => props.onDeleteEdge(edge.id)}
          >
            <TrashOutline18 aria-hidden className={iconMark} />
            이 연결 삭제
          </button>
        </section>
      ) : (
        <>
          <TestPanel onPower={props.onTestPower} power={props.testPower} />
          <TriggerFields devices={props.devices} onTriggers={props.onTriggers} trigger={props.triggers[0]} />
          <p className={muted}>
            캔버스에서 노드를 누르면 그 노드만 설정합니다. 선을 누르면 연결을 지울 수 있습니다.
          </p>
        </>
      )}
    </aside>
  );
};

const NodeHeader = (props: { readonly node: NodeInstance }) => {
  const meta = nodeMeta(props.node.type);
  return (
    <div className={panelHead}>
      <div className={`${panelTitleRow} ${tone[meta.category]}`}>
        <span className={iconWrap} style={{ color: accent }}>
          <NodeIcon type={props.node.type} />
        </span>
        <h2 className={cardTitle} style={{ margin: 0 }}>
          {meta.label}
        </h2>
        <span className={panelMono}>{props.node.id}</span>
      </div>
      <p className={muted} style={{ margin: 0 }}>
        {meta.hint}
      </p>
      <span className={panelMono}>{props.node.type}</span>
    </div>
  );
};
