/**
 * React Flow 노드 chrome.
 */
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { flowNode } from "../ui/editor.css.js";

export const FlowNode = (props: NodeProps) => {
  const type = String(props.data.type ?? "");
  return (
    <div className={flowNode} data-testid={`node-${props.id}`}>
      {type !== "core.input" ? (
        <Handle type="target" position={Position.Left} id="in" />
      ) : null}
      <strong>{props.data.title as string}</strong>
      <div>{props.id}</div>
      {type === "core.condition" ? (
        <>
          <Handle type="source" position={Position.Right} id="true" style={{ top: "35%" }} />
          <Handle type="source" position={Position.Right} id="false" style={{ top: "65%" }} />
        </>
      ) : (
        <Handle type="source" position={Position.Right} id="success" />
      )}
    </div>
  );
};
