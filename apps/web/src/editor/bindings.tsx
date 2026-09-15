/**
 * 선택 노드 binding·trigger.
 */
import type { InputBinding, WorkflowDefinition } from "@howling/core";

type NodeInstance = WorkflowDefinition["nodes"][number];
import type { TriggerBinding } from "@howling/contracts";
import { field, input, label } from "../ui/form.css.js";
import { cardTitle } from "../ui/card.css.js";
import { sidebar } from "../ui/editor.css.js";
import { EffectFields, type McpToolOption } from "./effect-fields.js";
import { TestPanel } from "./test-panel.js";

export const Bindings = (props: {
  readonly definition: WorkflowDefinition;
  readonly selectedId: string | undefined;
  readonly triggers: readonly TriggerBinding[];
  readonly onNode: (node: NodeInstance) => void;
  readonly onTriggers: (triggers: readonly TriggerBinding[]) => void;
  readonly testPower: string;
  readonly onTestPower: (value: string) => void;
  readonly tools: readonly McpToolOption[];
}) => {
  const node = props.definition.nodes.find((item) => item.id === props.selectedId);
  const trigger = props.triggers[0];
  const inputId = props.definition.nodes.find((item) => item.type === "core.input")?.id ?? "input";
  return (
    <aside className={sidebar}>
      <TestPanel onPower={props.onTestPower} power={props.testPower} />
      <h2 className={cardTitle}>Trigger</h2>
      <label className={field}>
        <span className={label}>HA entity</span>
        <input
          className={input}
          data-testid="trigger-entity"
          value={String(trigger?.config.entityId ?? "")}
          onChange={(event) =>
            props.onTriggers([
              {
                id: "ha-power",
                kind: "ha.state_changed",
                connectionId: "ha",
                config: { entityId: event.target.value, inputKey: "power" },
              },
            ])
          }
        />
      </label>
      {node ? (
        <NodeFields inputId={inputId} node={node} onNode={props.onNode} tools={props.tools} />
      ) : (
        <p>노드를 선택하세요.</p>
      )}
    </aside>
  );
};

const NodeFields = (props: {
  readonly inputId: string;
  readonly node: NodeInstance;
  readonly onNode: (node: NodeInstance) => void;
  readonly tools: readonly McpToolOption[];
}) => {
  const { node } = props;
  const setConfig = (key: string, value: number | string) =>
    props.onNode({ ...node, config: { ...node.config, [key]: value } });
  const setInput = (key: string, binding: InputBinding) =>
    props.onNode({ ...node, inputs: { ...node.inputs, [key]: binding } });
  return (
    <>
      <h2 className={cardTitle}>{node.type}</h2>
      {node.type === "analysis.rolling-mean" ? (
        <>
          <NumberField
            label="windowSize"
            testId="bind-window"
            value={Number(node.config.windowSize ?? 5)}
            onChange={(value) => setConfig("windowSize", value)}
          />
          <TextField
            label="value path"
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
        </>
      ) : null}
      {node.type === "core.condition" ? (
        <NumberField
          label="right"
          testId="bind-right"
          value={literalNumber(node.inputs.right)}
          onChange={(value) =>
            setInput("right", { kind: "literal", value })
          }
        />
      ) : null}
      {node.type === "core.effect" ? (
        <EffectFields node={node} onNode={props.onNode} tools={props.tools} />
      ) : null}
    </>
  );
};

const TextField = (props: {
  readonly label: string;
  readonly testId: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
}) => (
  <label className={field}>
    <span className={label}>{props.label}</span>
    <input
      className={input}
      data-testid={props.testId}
      value={props.value}
      onChange={(event) => props.onChange(event.target.value)}
    />
  </label>
);

const NumberField = (props: {
  readonly label: string;
  readonly testId: string;
  readonly value: number;
  readonly onChange: (value: number) => void;
}) => (
  <label className={field}>
    <span className={label}>{props.label}</span>
    <input
      className={input}
      data-testid={props.testId}
      type="number"
      value={Number.isFinite(props.value) ? props.value : 0}
      onChange={(event) => props.onChange(Number(event.target.value))}
    />
  </label>
);

const pathOf = (binding?: InputBinding): string =>
  binding && "path" in binding && typeof binding.path === "string" ? binding.path : "";

const literalNumber = (binding?: InputBinding): number =>
  binding && binding.kind === "literal" && typeof binding.value === "number"
    ? binding.value
    : 0;
