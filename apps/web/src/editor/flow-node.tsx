/**
 * React Flow 노드 카드. 아이콘·이름·설정 요약, 포트 이름을 보여 준다.
 */
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { isJoinType } from "../lib/flow-ports.js";
import { nodeMeta, portLabel } from "../lib/node-meta.js";
import * as css from "../ui/flow-node.css.js";
import { NodeIcon } from "./node-icon.js";

const percent = (index: number, count: number): string =>
  `${String(((index + 1) / (count + 1)) * 100)}%`;

export const FlowNode = (props: NodeProps) => {
  const type = String(props.data.type ?? "");
  const meta = nodeMeta(type);
  const inputNames = Array.isArray(props.data.inputNames)
    ? props.data.inputNames.filter((item): item is string => typeof item === "string")
    : [];
  const join = isJoinType(type);
  const summary = String(props.data.summary ?? "");
  const incomplete = props.data.incomplete === true;
  const condition = type === "core.condition";
  const className = [
    css.card,
    css.tone[meta.category],
    props.selected ? css.cardSelected : "",
    incomplete ? css.cardIncomplete : "",
    condition ? css.cardBranch : "",
    join ? css.cardJoin : "",
  ]
    .filter(Boolean)
    .join(" ");
  const minHeight = join ? `${String(Math.max(64, 28 + inputNames.length * 22))}px` : undefined;
  return (
    <div className={className} data-testid={`node-${props.id}`} style={minHeight ? { minHeight } : undefined}>
      {join
        ? inputNames.map((name, index) => (
            <Handle
              key={name}
              type="target"
              position={Position.Left}
              id={name}
              style={{ top: percent(index, inputNames.length) }}
              title={`${name} 입력`}
            />
          ))
        : type !== "core.input"
          ? <Handle type="target" position={Position.Left} id="in" title="이전 노드에서" />
          : null}
      <div className={css.head}>
        <span className={css.iconWrap}>
          <NodeIcon type={type} />
        </span>
        <span className={css.title} title={meta.hint}>
          {meta.label}
        </span>
        <span className={css.idTag}>{props.id}</span>
      </div>
      <div className={`${css.summary} ${incomplete ? css.summaryIncomplete : ""}`} title={summary}>
        {summary || meta.hint}
      </div>
      {join
        ? inputNames.map((name, index) => (
            <span
              key={`label-${name}`}
              className={`${css.portLabel} ${css.portLeft}`}
              style={{ top: percent(index, inputNames.length) }}
            >
              {name}
            </span>
          ))
        : null}
      {condition ? (
        <>
          <Handle type="source" position={Position.Right} id="true" style={{ top: "30%" }} title="참일 때" />
          <Handle type="source" position={Position.Right} id="false" style={{ top: "70%" }} title="거짓일 때" />
          <span className={`${css.portLabel} ${css.portRight}`} style={{ top: "30%" }}>
            {portLabel("true")}
          </span>
          <span className={`${css.portLabel} ${css.portRight}`} style={{ top: "70%" }}>
            {portLabel("false")}
          </span>
        </>
      ) : (
        <Handle type="source" position={Position.Right} id="success" title="다음 노드로" />
      )}
    </div>
  );
};
