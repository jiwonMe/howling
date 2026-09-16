/**
 * Map 입력 필드를 이름별로 묶는다.
 */
import type { InputBinding, WorkflowDefinition } from "@howling/core";
import { buttonRecipe } from "../ui/button.css.js";
import { field, input, label, select } from "../ui/form.css.js";
import { muted } from "../ui/editor.css.js";
import { outputOf } from "../lib/flow-ports.js";
import { formatLiteral, parseLiteral, pathOf, TextField } from "./field-inputs.js";

type NodeInstance = WorkflowDefinition["nodes"][number];

export const MapFields = (props: {
  readonly node: NodeInstance;
  readonly nodes: readonly NodeInstance[];
  readonly onNode: (node: NodeInstance) => void;
}) => {
  const keys = Object.keys(props.node.inputs);
  return (
    <>
      <p className={muted}>필드 이름과 값 출처를 고릅니다. 출력은 value 한 객체입니다.</p>
      {keys.map((name) => (
        <MapRow
          key={name}
          name={name}
          binding={props.node.inputs[name]}
          nodes={props.nodes.filter((item) => item.id !== props.node.id)}
          onName={(next) => renameField(props, name, next)}
          onBinding={(binding) =>
            props.onNode({
              ...props.node,
              inputs: { ...props.node.inputs, [name]: binding },
            })
          }
          onRemove={() =>
            props.onNode({
              ...props.node,
              inputs: Object.fromEntries(
                Object.entries(props.node.inputs).filter(([key]) => key !== name),
              ),
            })
          }
        />
      ))}
      <button
        className={buttonRecipe()}
        data-testid="bind-map-add"
        type="button"
        onClick={() => addField(props)}
      >
        필드 추가
      </button>
    </>
  );
};

const MapRow = (props: {
  readonly name: string;
  readonly binding: InputBinding | undefined;
  readonly nodes: readonly NodeInstance[];
  readonly onName: (name: string) => void;
  readonly onBinding: (binding: InputBinding) => void;
  readonly onRemove: () => void;
}) => {
  const binding = props.binding;
  const kind = binding?.kind === "literal" ? "literal" : "output";
  return (
    <fieldset className={field} data-testid={`bind-map-field-${props.name}`}>
      <TextField label="필드" testId={`bind-map-name-${props.name}`} value={props.name} onChange={props.onName} />
      <label className={field}>
        <span className={label}>출처</span>
        <select
          className={select}
          data-testid={`bind-map-kind-${props.name}`}
          value={kind}
          onChange={(event) => props.onBinding(switchKind(event.target.value, binding, props.nodes[0]))}
        >
          <option value="output">노드 출력</option>
          <option value="literal">직접 값</option>
        </select>
      </label>
      {kind === "literal" ? (
        <TextField
          label="값"
          testId={`bind-map-literal-${props.name}`}
          value={formatLiteral(binding && binding.kind === "literal" ? binding.value : "")}
          onChange={(value) => props.onBinding({ kind: "literal", value: parseLiteral(value) })}
        />
      ) : (
        <OutputPick
          binding={binding && binding.kind === "output" ? binding : undefined}
          name={props.name}
          nodes={props.nodes}
          onBinding={props.onBinding}
        />
      )}
      <button className={buttonRecipe()} type="button" onClick={props.onRemove}>
        필드 삭제
      </button>
    </fieldset>
  );
};

const OutputPick = (props: {
  readonly name: string;
  readonly binding: Extract<InputBinding, { kind: "output" }> | undefined;
  readonly nodes: readonly NodeInstance[];
  readonly onBinding: (binding: InputBinding) => void;
}) => {
  const nodeId = props.binding?.nodeId ?? props.nodes[0]?.id ?? "";
  const source = props.nodes.find((item) => item.id === nodeId);
  return (
    <>
      <label className={field}>
        <span className={label}>노드</span>
        <select
          className={select}
          data-testid={`bind-map-node-${props.name}`}
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
      <label className={field}>
        <span className={label}>출력</span>
        <input
          className={input}
          data-testid={`bind-map-output-${props.name}`}
          value={props.binding?.output ?? outputOf(source?.type ?? "")}
          onChange={(event) =>
            props.onBinding({
              kind: "output",
              nodeId,
              output: event.target.value,
              ...(pathOf(props.binding) ? { path: pathOf(props.binding) } : {}),
            })
          }
        />
      </label>
      <TextField
        label="path"
        testId={`bind-map-path-${props.name}`}
        value={pathOf(props.binding)}
        onChange={(value) =>
          props.onBinding({
            kind: "output",
            nodeId,
            output: props.binding?.output ?? outputOf(source?.type ?? ""),
            ...(value ? { path: value } : {}),
          })
        }
      />
    </>
  );
};

const unusedField = (inputs: NodeInstance["inputs"]): string => {
  if (!inputs.field) {
    return "field";
  }
  let index = 2;
  while (inputs[`field-${String(index)}`]) {
    index += 1;
  }
  return `field-${String(index)}`;
};

const addField = (props: {
  readonly node: NodeInstance;
  readonly nodes: readonly NodeInstance[];
  readonly onNode: (node: NodeInstance) => void;
}) => {
  const previous = props.nodes.at(-1);
  const name = unusedField(props.node.inputs);
  props.onNode({
    ...props.node,
    inputs: {
      ...props.node.inputs,
      [name]: previous
        ? { kind: "output", nodeId: previous.id, output: outputOf(previous.type) }
        : { kind: "literal", value: "" },
    },
  });
};

const renameField = (
  props: { readonly node: NodeInstance; readonly onNode: (node: NodeInstance) => void },
  from: string,
  to: string,
) => {
  const next = to.trim();
  if (!next || next === from || props.node.inputs[next]) {
    return;
  }
  props.onNode({
    ...props.node,
    inputs: Object.fromEntries(
      Object.entries(props.node.inputs).map(([key, binding]) =>
        key === from ? [next, binding] : [key, binding],
      ),
    ),
  });
};

const switchKind = (
  kind: string,
  binding: InputBinding | undefined,
  fallback?: NodeInstance,
): InputBinding => {
  if (kind === "literal") {
    return { kind: "literal", value: "" };
  }
  if (binding?.kind === "output") {
    return binding;
  }
  return {
    kind: "output",
    nodeId: fallback?.id ?? "",
    output: outputOf(fallback?.type ?? ""),
  };
};
