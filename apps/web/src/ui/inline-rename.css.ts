/**
 * 제자리 이름 변경. 평소엔 이름 옆 연필, 누르면 같은 자리에 입력 칸.
 */
import { style, styleVariants } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css.js";

export const row = style({
  display: "inline-flex",
  alignItems: "center",
  gap: vars.space.xs,
  minWidth: 0,
});

export const penButton = style({
  display: "inline-flex",
  border: "none",
  background: "transparent",
  padding: "2px",
  borderRadius: vars.radius.md,
  color: vars.color.subtle,
  cursor: "pointer",
  opacity: 0.6,
  transition: "opacity 120ms ease, color 120ms ease",
  selectors: {
    [`${row}:hover &, &:focus-visible`]: { opacity: 1 },
    "&:hover": { color: vars.color.text, backgroundColor: vars.color.hover },
    "&:focus-visible": {
      outline: `2px solid ${vars.color.focus}`,
      outlineOffset: "1px",
    },
  },
});

export const form = style({
  display: "flex",
  flexDirection: "column",
  gap: vars.space.xs,
  minWidth: 0,
});

export const controls = style({
  display: "flex",
  alignItems: "center",
  gap: vars.space.xs,
});

export const input = styleVariants({
  title: {
    minWidth: "12rem",
    border: `1px solid ${vars.color.borderStrong}`,
    borderRadius: vars.radius.md,
    backgroundColor: vars.color.bg,
    color: vars.color.text,
    padding: `2px ${vars.space.sm}`,
    fontSize: vars.font.xl,
    fontWeight: vars.weight.heading,
    letterSpacing: "-0.02em",
    lineHeight: 1.2,
  },
  row: {
    minWidth: "10rem",
    border: `1px solid ${vars.color.borderStrong}`,
    borderRadius: vars.radius.md,
    backgroundColor: vars.color.bg,
    color: vars.color.text,
    padding: `${vars.space.xs} ${vars.space.sm}`,
    fontSize: vars.font.sm,
  },
});

export const compactButton = style({
  padding: `${vars.space.xs} ${vars.space.sm}`,
});
