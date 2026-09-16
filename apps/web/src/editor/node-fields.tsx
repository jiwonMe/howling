/**
 * 노드 종류별 설정 필드. 라벨은 우리말, 저장값은 core 계약 그대로.
 */
import type { DeviceSummary } from "@howling/contracts";
import type { InputBinding, WorkflowDefinition } from "@howling/core";
import { OPERATOR_LABELS } from "../lib/node-meta.js";
import { field, label, select } from "../ui/form.css.js";
import { muted } from "../ui/editor.css.js";
import { EffectFields, type McpToolOption } from "./effect-fields.js";
import { NumberField, TextField, literalNumber, pathOf } from "./field-inputs.js";
import { JoinFields } from "./join-fields.js";
import { MapFields } from "./map-fields.js";

type NodeInstance = WorkflowDefinition["nodes"][number];

const OPERATORS = ["eq", "neq", "gt", "gte", "lt", "lte", "isTrue", "isFalse"] as const;

export const NodeFields = (props: {
  readonly definition: WorkflowDefinition;
  readonly devices: readonly DeviceSummary[];
  readonly inputId: string;
  readonly node: NodeInstance;
  readonly onDefinition: (definition: WorkflowDefinition) => void;
  readonly onNode: (node: NodeInstance) => void;
  readonly tools: readonly McpToolOption[];
}) => {
  const { node } = props;
  const setConfig = (key: string, value: number | string) =>
    props.onNode({ ...node, config: { ...node.config, [key]: value } });
  const setInput = (key: string, binding: InputBinding) =>
    props.onNode({ ...node, inputs: { ...node.inputs, [key]: binding } });
  const operator = String(node.config.operator ?? "gt");
  const needsRight = operator !== "isTrue" && operator !== "isFalse";
  switch (node.type) {
    case "core.input":
      return <p className={muted}>설정할 것이 없습니다. 트리거 값이 그대로 다음 노드로 갑니다.</p>;
    case "analysis.rolling-mean":
      return (
        <>
          <NumberField
            label="평균 낼 개수"
            testId="bind-window"
            value={Number(node.config.windowSize ?? 5)}
            onChange={(value) => setConfig("windowSize", value)}
          />
          <TextField
            label="읽을 값 (path)"
            testId="bind-mean-path"
            value={pathOf(node.inputs.value)}
            onChange={(value) =>
              setInput("value", {
                kind: "output",
                nodeId: props.inputId,
                output: "value",
                path: value === "" ? "/power" : value,
              })
            }
          />
          <p className={muted}>예: 전력 값이면 /power. 최근 값이 모일수록 평균이 안정됩니다.</p>
        </>
      );
    case "core.condition":
      return (
        <>
          <label className={field}>
            <span className={label}>비교 방법</span>
            <select
              className={select}
              data-testid="bind-operator"
              value={operator}
              onChange={(event) => setConfig("operator", event.target.value)}
            >
              {OPERATORS.map((item) => (
                <option key={item} value={item}>
                  {OPERATOR_LABELS[item]?.symbol} {OPERATOR_LABELS[item]?.text} ({item})
                </option>
              ))}
            </select>
          </label>
          {needsRight ? (
            <NumberField
              label="비교값"
              testId="bind-right"
              value={literalNumber(node.inputs.right)}
              onChange={(value) => setInput("right", { kind: "literal", value })}
            />
          ) : null}
          <p className={muted}>맞으면 「참」 포트, 아니면 「거짓」 포트로 이어진 노드가 실행됩니다.</p>
        </>
      );
    case "core.delay":
      return (
        <>
          <NumberField
            label="대기 시간 (ms)"
            testId="bind-duration"
            value={Number(node.config.durationMs ?? 1000)}
            onChange={(value) => setConfig("durationMs", value)}
          />
          <p className={muted}>1000 = 1초, 60000 = 1분.</p>
        </>
      );
    case "core.map":
      return <MapFields node={node} nodes={props.definition.nodes} onNode={props.onNode} />;
    case "core.all":
    case "core.any":
      return <JoinFields definition={props.definition} node={node} onDefinition={props.onDefinition} />;
    case "core.effect":
      return (
        <EffectFields devices={props.devices} node={node} onNode={props.onNode} tools={props.tools} />
      );
    default:
      return null;
  }
};
