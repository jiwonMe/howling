/**
 * 페이지 골격.
 */
import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { vars } from "../styles/theme.css.js";

export const page = recipe({
  base: {
    minHeight: "100vh",
    backgroundColor: vars.color.bg,
    padding: vars.space.xxl,
  },
  variants: {
    tone: {
      default: { color: vars.color.text },
      muted: { color: vars.color.muted },
      error: { color: vars.color.error },
    },
  },
  defaultVariants: {
    tone: "default",
  },
});

export const header = style({
  marginBottom: vars.space.xxl,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: vars.space.lg,
});

export const title = style({
  fontSize: vars.font.xxl,
  fontWeight: 600,
  margin: 0,
});

export const subtitle = style({
  fontSize: vars.font.sm,
  color: vars.color.muted,
  margin: `${vars.space.xs} 0 0`,
});

export const cardGrid = style({
  display: "grid",
  gap: vars.space.lg,
  "@media": {
    "screen and (min-width: 768px)": {
      gridTemplateColumns: "1fr 1fr",
    },
  },
});

export const navRow = style({
  display: "flex",
  gap: vars.space.md,
  alignItems: "center",
});
