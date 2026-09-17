/**
 * 여러 값 가상 기기 필드 한 줄.
 */
import { style } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css.js";

export const fieldRow = style({
  display: "grid",
  gridTemplateColumns: "1fr 1fr auto",
  gap: vars.space.sm,
  alignItems: "end",
});

export const fieldOptions = style({
  gridColumn: "1 / -1",
});
