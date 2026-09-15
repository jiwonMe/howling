import { style } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css.js";

export const chartGrid = style({
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(16rem, 1fr))",
  gap: vars.space.lg,
});

export const chartCard = style({
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  padding: vars.space.lg,
  minWidth: 0,
});

export const spark = style({
  width: "100%",
  height: "6rem",
});
