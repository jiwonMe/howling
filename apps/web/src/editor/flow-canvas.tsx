/**
 * React Flow 캔버스.
 */
import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { WorkflowDefinition } from "@howling/core";
import { officialCatalog } from "@howling/contracts";
import { canvasWrap } from "../ui/editor.css.js";
import { FlowNode } from "./flow-node.js";

const nodeTypes: NodeTypes = { howling: FlowNode };

export const FlowCanvas = (props: {
  readonly definition: WorkflowDefinition;
  readonly positions: Record<string, { x: number; y: number }>;
  readonly selectedId: string | undefined;
  readonly onSelect: (id?: string) => void;
  readonly onPositions: (positions: Record<string, { x: number; y: number }>) => void;
  readonly onConnect: (edge: Connection) => void;
}) => {
  const nodes: Node[] = props.definition.nodes.map((node, index) => ({
    id: node.id,
    type: "howling",
    position: props.positions[node.id] ?? { x: index * 220, y: 80 },
    selected: props.selectedId === node.id,
    data: {
      type: node.type,
      title: officialCatalog.find((item) => item.type === node.type)?.title ?? node.type,
    },
  }));
  const edges: Edge[] = props.definition.edges.map((edge) => ({
    id: edge.id,
    source: edge.source.nodeId,
    target: edge.target.nodeId,
    sourceHandle: edge.source.port,
    targetHandle: edge.target.port,
  }));
  return (
    <div className={canvasWrap} data-testid="canvas">
      <ReactFlowProvider>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={(_event, node) => props.onSelect(node.id)}
        onPaneClick={() => props.onSelect(undefined)}
        onNodeDragStop={(_event, node) =>
          props.onPositions({ ...props.positions, [node.id]: node.position })
        }
        onConnect={(connection) => props.onConnect(connection)}
        fitView
        style={{ width: "100%", height: "100%" }}
      >
        <Background />
        <Controls />
      </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
};
