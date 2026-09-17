/**
 * 여러 값 가상 기기의 필드 목록. entity_id는 받지 않는다.
 */
import type { VirtualField, VirtualFieldType } from "@howling/contracts";
import { buttonRecipe } from "../ui/button.css.js";
import { field, input, label, select } from "../ui/form.css.js";
import { caption } from "../ui/layout.css.js";
import { fieldOptions, fieldRow } from "./device-create-fields.css.js";

export type FieldDraft = {
  readonly key: string;
  readonly label: string;
  readonly type: VirtualFieldType;
  readonly options: string;
};

export const emptyField = (): FieldDraft => ({ key: "", label: "", type: "boolean", options: "" });

export const fieldsOfDrafts = (drafts: readonly FieldDraft[]): VirtualField[] =>
  drafts.flatMap((item) => {
    const key = item.key.trim();
    const labelText = item.label.trim();
    if (key === "") {
      return [];
    }
    const options = item.options
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part !== "");
    return [
      {
        key,
        type: item.type,
        ...(labelText ? { label: labelText } : {}),
        ...(item.type === "select" && options.length > 0 ? { options } : {}),
      },
    ];
  });

export const DeviceCreateFields = (props: {
  readonly drafts: readonly FieldDraft[];
  readonly onDrafts: (drafts: FieldDraft[]) => void;
}) => (
  <div data-testid="device-fields">
    <p className={caption}>한 기기에 스위치·숫자·글자를 여러 개 넣습니다. key=state 는 현재 상태가 됩니다.</p>
    {props.drafts.map((item, index) => (
      <div className={fieldRow} key={index}>
        <label className={field}>
          <span className={label}>키</span>
          <input
            className={input}
            data-testid={`device-field-key-${index}`}
            maxLength={32}
            value={item.key}
            onChange={(event) => patch(props, index, { key: event.target.value })}
          />
        </label>
        <label className={field}>
          <span className={label}>이름</span>
          <input
            className={input}
            data-testid={`device-field-label-${index}`}
            maxLength={64}
            value={item.label}
            onChange={(event) => patch(props, index, { label: event.target.value })}
          />
        </label>
        <label className={field}>
          <span className={label}>형식</span>
          <select
            className={select}
            data-testid={`device-field-type-${index}`}
            value={item.type}
            onChange={(event) =>
              patch(props, index, { type: event.target.value as VirtualFieldType })
            }
          >
            <option value="boolean">스위치</option>
            <option value="number">숫자</option>
            <option value="text">글자</option>
            <option value="select">선택</option>
          </select>
        </label>
        {item.type === "select" ? (
          <label className={`${field} ${fieldOptions}`}>
            <span className={label}>선택 항목 (쉼표)</span>
            <input
              className={input}
              data-testid={`device-field-options-${index}`}
              placeholder="sunny, cloudy, rainy"
              value={item.options}
              onChange={(event) => patch(props, index, { options: event.target.value })}
            />
          </label>
        ) : null}
        {props.drafts.length > 1 ? (
          <button
            className={buttonRecipe()}
            data-testid={`device-field-remove-${index}`}
            type="button"
            onClick={() =>
              props.onDrafts(props.drafts.filter((_, itemIndex) => itemIndex !== index))
            }
          >
            빼기
          </button>
        ) : null}
      </div>
    ))}
    <button
      className={buttonRecipe()}
      data-testid="device-field-add"
      type="button"
      onClick={() => props.onDrafts([...props.drafts, emptyField()])}
    >
      필드 추가
    </button>
  </div>
);

const patch = (
  props: { readonly drafts: readonly FieldDraft[]; readonly onDrafts: (drafts: FieldDraft[]) => void },
  index: number,
  next: Partial<FieldDraft>,
): void => {
  props.onDrafts(props.drafts.map((item, itemIndex) => (itemIndex === index ? { ...item, ...next } : item)));
};
