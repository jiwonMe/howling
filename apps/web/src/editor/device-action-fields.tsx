/**
 * 기기 동작 값. entity_id 입력은 없다.
 */
import { fieldsOf, type DeviceAction, type DeviceActionField, type DeviceKind } from "@howling/contracts";
import { field, input, label, select } from "../ui/form.css.js";

export const DeviceActionFields = (props: {
  readonly kind?: DeviceKind;
  readonly action: DeviceAction | "";
  readonly data: Record<string, string | number | boolean>;
  readonly onData: (data: Record<string, string | number | boolean>) => void;
  readonly extraFields?: readonly DeviceActionField[];
  readonly testIdPrefix?: string;
}) => {
  const listed =
    props.extraFields && props.extraFields.length > 0
      ? props.extraFields
      : props.kind && props.action
        ? fieldsOf(props.kind, props.action)
        : [];
  if (listed.length === 0) {
    return null;
  }
  return (
    <>
      {listed.map((item) => (
        <ActionField
          data={props.data}
          field={item}
          key={item.key}
          onData={props.onData}
          testIdPrefix={props.testIdPrefix ?? "bind-action"}
        />
      ))}
    </>
  );
};

const ActionField = (props: {
  readonly field: DeviceActionField;
  readonly data: Record<string, string | number | boolean>;
  readonly onData: (data: Record<string, string | number | boolean>) => void;
  readonly testIdPrefix: string;
}) => {
  const value = props.data[props.field.key];
  const set = (next: string | number | boolean) => {
    props.onData({ ...props.data, [props.field.key]: next });
  };
  return (
    <label className={field}>
      <span className={label}>{props.field.label}</span>
      {props.field.type === "select" ? (
        <select
          className={select}
          data-testid={`${props.testIdPrefix}-${props.field.key}`}
          required={props.field.required}
          value={value === undefined ? "" : String(value)}
          onChange={(event) => set(event.target.value)}
        >
          <option value="">선택</option>
          {(props.field.options ?? []).map((item) => (
            <option key={item.key} value={item.key}>
              {item.name}
            </option>
          ))}
        </select>
      ) : props.field.type === "boolean" ? (
        <select
          className={select}
          data-testid={`${props.testIdPrefix}-${props.field.key}`}
          required={props.field.required}
          value={value === true ? "true" : value === false ? "false" : ""}
          onChange={(event) => set(event.target.value === "true")}
        >
          <option value="">선택</option>
          <option value="true">켜기</option>
          <option value="false">끄기</option>
        </select>
      ) : (
        <input
          className={input}
          data-testid={`${props.testIdPrefix}-${props.field.key}`}
          required={props.field.required}
          type={props.field.type === "number" ? "number" : "text"}
          value={value === undefined ? "" : String(value)}
          onChange={(event) =>
            set(props.field.type === "number" ? Number(event.target.value) : event.target.value)
          }
        />
      )}
    </label>
  );
};
