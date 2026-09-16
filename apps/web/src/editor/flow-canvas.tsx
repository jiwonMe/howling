/**
 * React Flow 캔버스. 선에는 포트 이름과 화살표, 빈 캔버스에는 시작 안내.
 */
import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  type Connection,
  type Edge,
  type FitViewOptions,
  type Node,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { DeviceSummary } from "@howling/contracts";
import type { WorkflowDefinition } from "@howling/core";
import { defaultPosition } from "../lib/flow-model.js";
import { portLabel } from "../lib/node-meta.js";
import { summarizeNode } from "../lib/node-summary.js";
import { canvasWrap, emptyHint } from "../ui/editor.css.js";
import { FlowNode } from "./flow-node.js";

const nodeTypes: NodeTypes = { howling: FlowNode };

/** 팔레트·툴바·오른쪽 패널이 덮는 만큼 비워 두고 맞춘다. */
const fitViewOptions: FitViewOptions = {
  padding: 0.2,
  minZoom: 0.55,
  maxZoom: 1,
};

const edgeLabel = (edge: WorkflowDefinition["edges"][number], joinTarget: boolean): string | undefined => {
  if (edge.source.port === "true" || edge.source.port === "false") {
    return portLabel(edge.source.port);
  }
  return joinTarget ? edge.target.port : undefined;
};

export const FlowCanvas = (props: {
  readonly definition: WorkflowDefinition;
  readonly devices: readonly DeviceSummary[];
  readonly positions: Record<string, { x: number; y: number }>;
  readonly selectedId: string | undefined;
  readonly selectedEdgeId: string | undefined;
  readonly onSelect: (id?: string) => void;
  readonly onSelectEdge: (id?: string) => void;
  readonly onPositions: (positions: Record<string, { x: number; y: number }>) => void;
  readonly onConnect: (edge: Connection) => void;
  readonly onDeleteNodes: (ids: readonly string[]) => void;
  readonly onDeleteEdges: (ids: readonly string[]) => void;
}) => {
  const joinIds = new Set(
    props.definition.nodes
      .filter((node) => node.type === "core.all" || node.type === "core.any")
      .map((node) => node.id),
  );
  const nodes: Node[] = props.definition.nodes.map((node, index) => {
    const summary = summarizeNode(node, props.devices);
    return {
      id: node.id,
      type: "howling",
      position: props.positions[node.id] ?? defaultPosition(index),
      selected: props.selectedId === node.id,
      data: {
        type: node.type,
        inputNames: Array.isArray(node.config.inputNames) ? node.config.inputNames : [],
        summary: summary.text,
        incomplete: summary.incomplete,
      },
    };
  });
  const edges: Edge[] = props.definition.edges.map((edge) => ({
    id: edge.id,
    source: edge.source.nodeId,
    target: edge.target.nodeId,
    sourceHandle: edge.source.port,
    targetHandle: edge.target.port,
    type: "smoothstep",
    selected: props.selectedEdgeId === edge.id,
    label: edgeLabel(edge, joinIds.has(edge.target.nodeId)),
    markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
  }));
  return (
    <div className={canvasWrap} data-testid="canvas">
      {props.definition.nodes.length === 0 ? (
        <p className={emptyHint}>
          왼쪽 목록에서 「입력」을 눌러 시작하세요. 이어서 누르는 노드는 자동으로 연결됩니다.
        </p>
      ) : null}
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          deleteKeyCode={["Backspace", "Delete"]}
          onNodeClick={(_event, node) => {
            props.onSelectEdge(undefined);
            props.onSelect(node.id);
          }}
          onEdgeClick={(_event, edge) => {
            props.onSelect(undefined);
            props.onSelectEdge(edge.id);
          }}
          onPaneClick={() => {
            props.onSelect(undefined);
            props.onSelectEdge(undefined);
          }}
          onNodeDragStop={(_event, node) =>
            props.onPositions({ ...props.positions, [node.id]: node.position })
          }
          onConnect={(connection) => props.onConnect(connection)}
          onNodesDelete={(deleted) => props.onDeleteNodes(deleted.map((node) => node.id))}
          onEdgesDelete={(deleted) => props.onDeleteEdges(deleted.map((edge) => edge.id))}
          fitView
          fitViewOptions={fitViewOptions}
          style={{ width: "100%", height: "100%" }}
        >
          <Background gap={20} />
          <Controls fitViewOptions={fitViewOptions} showInteractive={false} />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
};
