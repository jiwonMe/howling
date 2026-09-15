/**
 * Effect를 Howling 기기로 고른다. entity_id는 저장하지 않는다.
 */
import type { DeviceAction, DeviceSummary } from "@howling/contracts";
import type { JsonValue, WorkflowDefinition } from "@howling/core";
import { field, label, select } from "../ui/form.css.js";

type NodeInstance = WorkflowDefinition["nodes"][number];

export const deviceEffectPatch = (node: NodeInstance): NodeInstance => ({
  ...node,
  config: { ...node.config, adapter: "device", operation: "action" },
  inputs: {
    ...node.inputs,
    request: {
      kind: "literal",
      value: { deviceId: "", action: "turn_on" } satisfies JsonValue,
    },
  },
});

export const DeviceFields = (props: {
  readonly node: NodeInstance;
  readonly onNode: (node: NodeInstance) => void;
  readonly devices: readonly DeviceSummary[];
}) => {
  const request = deviceRequest(props.node.inputs.request);
  const actionable = props.devices.filter(
    (item) =>
      item.actions.length > 0 && (item.available || item.id === request.deviceId),
  );
  const chosen = actionable.find((item) => item.id === request.deviceId);
  const actions = chosen?.actions ?? [];
  const set = (next: { readonly deviceId?: string; readonly action?: DeviceAction | "" }) => {
    const deviceId = next.deviceId ?? request.deviceId;
    const picked = actionable.find((item) => item.id === deviceId);
    const allowed = picked?.actions ?? [];
    const current = allowed.find((item) => item === request.action);
    const action =
      next.action !== undefined && next.action !== ""
        ? next.action
        : (current ?? allowed[0] ?? "");
    props.onNode({
      ...props.node,
      inputs: {
        ...props.node.inputs,
        request: {
          kind: "literal",
          value: { deviceId, action } satisfies JsonValue,
        },
      },
    });
  };
  return (
    <>
      <label className={field}>
        <span className={label}>동작 기기</span>
        <select
          className={select}
          data-testid="bind-device"
          value={request.deviceId}
          onChange={(event) => set({ deviceId: event.target.value })}
        >
          <option value="">선택</option>
          {actionable.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label className={field}>
        <span className={label}>동작</span>
        <select
          className={select}
          data-testid="bind-action"
          value={request.action}
          onChange={(event) => set({ action: event.target.value as DeviceAction })}
        >
          <option value="">선택</option>
          {actions.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
    </>
  );
};

const deviceRequest = (binding?: { kind?: string; value?: unknown }) => {
  if (!binding || binding.kind !== "literal" || !binding.value || typeof binding.value !== "object") {
    return { deviceId: "", action: "" as DeviceAction | "" };
  }
  const value = binding.value as { deviceId?: string; action?: DeviceAction };
  return { deviceId: value.deviceId ?? "", action: value.action ?? "" };
};
