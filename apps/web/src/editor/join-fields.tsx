/**
 * All·Any의 입력 이름과 값 바인딩.
 */
import type { InputBinding, WorkflowDefinition } from "@howling/core";
import { field, label, select } from "../ui/form.css.js";
import { muted } from "../ui/editor.css.js";
import { joinNamesOf, outputOf, parseJoinNames } from "../lib/flow-ports.js";
import { replaceNode, setJoinNames } from "../lib/flow-model.js";
import { TextField } from "./field-inputs.js";

type NodeInstance = WorkflowDefinition["nodes"][number];

export const JoinFields = (props: {
  readonly definition: WorkflowDefinition;
  readonly node: NodeInstance;
  readonly onDefinition: (definition: WorkflowDefinition) => void;
}) => {
  const names = joinNamesOf(props.node.config);
  const others = props.definition.nodes.filter((item) => item.id !== props.node.id);
  return (
    <>
      <p className={muted}>
        이름마다 캔버스 선과 값이 필요합니다. All은 모두, Any는 먼저 온 쪽만 씁니다.
      </p>
      <TextField
        label="입력 이름"
        testId="bind-join-names"
        value={names.join(", ")}
        onChange={(value) =>
          props.onDefinition(setJoinNames(props.definition, props.node.id, parseJoinNames(value)))
        }
      />
      {names.map((name) => (
        <JoinBinding
          key={name}
          name={name}
          binding={props.node.inputs[name]}
          nodes={others}
          onBinding={(binding) =>
            props.onDefinition(
              replaceNode(props.definition, props.node.id, {
                inputs: { ...props.node.inputs, [name]: binding },
              }),
            )
          }
        />
      ))}
    </>
  );
};

const JoinBinding = (props: {
  readonly name: string;
  readonly binding: InputBinding | undefined;
  readonly nodes: readonly NodeInstance[];
  readonly onBinding: (binding: InputBinding) => void;
}) => {
  const nodeId =
    props.binding?.kind === "output" ? props.binding.nodeId : (props.nodes[0]?.id ?? "");
  return (
    <label className={field}>
      <span className={label}>{props.name} 값</span>
      <select
        className={select}
        data-testid={`bind-join-node-${props.name}`}
        value={nodeId}
        onChange={(event) => {
          const next = props.nodes.find((item) => item.id === event.target.value);
          props.onBinding({
            kind: "output",
            nodeId: event.target.value,
            output: outputOf(next?.type ?? ""),
          });
        }}
      >
        {props.nodes.map((item) => (
          <option key={item.id} value={item.id}>
            {item.id}
          </option>
        ))}
      </select>
    </label>
  );
};
