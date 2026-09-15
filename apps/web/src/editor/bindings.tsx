/**
 * 선택 노드 binding·trigger.
 */
import type { DeviceSummary, TriggerBinding } from "@howling/contracts";
import type { InputBinding, WorkflowDefinition } from "@howling/core";
import { field, input, label, select } from "../ui/form.css.js";
import { cardTitle } from "../ui/card.css.js";
import { sidebar } from "../ui/editor.css.js";
import { EffectFields, type McpToolOption } from "./effect-fields.js";
import { TestPanel } from "./test-panel.js";

type NodeInstance = WorkflowDefinition["nodes"][number];

export const Bindings = (props: {
  readonly definition: WorkflowDefinition;
  readonly selectedId: string | undefined;
  readonly triggers: readonly TriggerBinding[];
  readonly onNode: (node: NodeInstance) => void;
  readonly onTriggers: (triggers: readonly TriggerBinding[]) => void;
  readonly testPower: string;
  readonly onTestPower: (value: string) => void;
  readonly tools: readonly McpToolOption[];
  readonly devices: readonly DeviceSummary[];
}) => {
  const node = props.definition.nodes.find((item) => item.id === props.selectedId);
  const trigger = props.triggers[0];
  const inputId = props.definition.nodes.find((item) => item.type === "core.input")?.id ?? "input";
  return (
    <aside className={sidebar}>
      <TestPanel onPower={props.onTestPower} power={props.testPower} />
      <TriggerFields
        devices={props.devices}
        onTriggers={props.onTriggers}
        trigger={trigger}
      />
      {node ? (
        <NodeFields
          devices={props.devices}
          inputId={inputId}
          node={node}
          onNode={props.onNode}
          tools={props.tools}
        />
      ) : (
        <p>노드를 선택하세요.</p>
      )}
    </aside>
  );
};

const TriggerFields = (props: {
  readonly devices: readonly DeviceSummary[];
  readonly trigger: TriggerBinding | undefined;
  readonly onTriggers: (triggers: readonly TriggerBinding[]) => void;
}) => {
  const advanced = props.trigger?.kind === "ha.state_changed";
  const deviceId =
    props.trigger?.kind === "device.changed" ? String(props.trigger.config.deviceId ?? "") : "";
  const triggerable = props.devices.filter(
    (item) =>
      (item.available || item.id === deviceId) &&
      ((item.kind === "number" && item.numeric) || item.kind === "binary"),
  );
  return (
    <>
      <h2 className={cardTitle}>Trigger</h2>
      {advanced ? (
        <label className={field}>
          <span className={label}>HA entity</span>
          <input
            className={input}
            data-testid="trigger-entity"
            value={String(props.trigger?.config.entityId ?? "")}
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
      ) : (
        <label className={field}>
          <span className={label}>트리거 기기</span>
          <select
            className={select}
            data-testid="trigger-device"
            value={deviceId}
            onChange={(event) => {
              const nextId = event.target.value;
              const picked = triggerable.find((item) => item.id === nextId);
              props.onTriggers([
                {
                  id: "device-trigger",
                  kind: "device.changed",
                  connectionId: "ha",
                  config: {
                    deviceId: nextId,
                    inputKey: picked?.kind === "binary" ? "value" : "power",
                  },
                },
              ]);
            }}
          >
            <option value="">선택</option>
            {triggerable.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className={field}>
        <input
          checked={advanced}
          type="checkbox"
          onChange={(event) => {
            if (event.target.checked) {
              props.onTriggers([
                {
                  id: "ha-power",
                  kind: "ha.state_changed",
                  connectionId: "ha",
                  config: { entityId: "", inputKey: "power" },
                },
              ]);
              return;
            }
            props.onTriggers([
              {
                id: "device-trigger",
                kind: "device.changed",
                connectionId: "ha",
                config: { deviceId: "", inputKey: "power" },
              },
            ]);
          }}
        />
        <span className={label}>고급: HA entity</span>
      </label>
    </>
  );
};

const NodeFields = (props: {
  readonly devices: readonly DeviceSummary[];
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
          onChange={(value) => setInput("right", { kind: "literal", value })}
        />
      ) : null}
      {node.type === "core.effect" ? (
        <EffectFields
          devices={props.devices}
          node={node}
          onNode={props.onNode}
          tools={props.tools}
        />
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
  binding && binding.kind === "literal" && typeof binding.value === "number" ? binding.value : 0;
