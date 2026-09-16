/**
 * 편집기 오른쪽 패널의 짧은 입력.
 */
import type { InputBinding } from "@howling/core";
import { field, input, label } from "../ui/form.css.js";

export const TextField = (props: {
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

export const NumberField = (props: {
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

export const pathOf = (binding?: InputBinding): string =>
  binding && "path" in binding && typeof binding.path === "string" ? binding.path : "";

export const literalNumber = (binding?: InputBinding): number =>
  binding && binding.kind === "literal" && typeof binding.value === "number" ? binding.value : 0;

export const parseLiteral = (raw: string): string | number | boolean | null => {
  const trimmed = raw.trim();
  if (trimmed === "true") {
    return true;
  }
  if (trimmed === "false") {
    return false;
  }
  if (trimmed === "null") {
    return null;
  }
  if (trimmed !== "" && Number.isFinite(Number(trimmed))) {
    return Number(trimmed);
  }
  return raw;
};

export const formatLiteral = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }
  if (value === undefined) {
    return "";
  }
  return JSON.stringify(value);
};
