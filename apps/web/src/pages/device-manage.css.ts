/**
 * 기기 이름 변경·삭제 줄.
 */
import { style } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css.js";

export const manageRow = style({
  display: "flex",
  flexWrap: "wrap",
  gap: vars.space.sm,
});
