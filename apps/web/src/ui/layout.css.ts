/**
 * 페이지 제목과 오프닝. 카드 격자는 더 쓰지 않는다.
 */
import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { vars } from "../styles/theme.css.js";

export const page = recipe({
  base: {
    display: "flex",
    flexDirection: "column",
    gap: vars.space.xl,
    minWidth: 0,
    flex: 1,
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
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: vars.space.lg,
});

export const title = style({
  fontSize: vars.font.xxl,
  fontWeight: vars.weight.heading,
  letterSpacing: "-0.03em",
  lineHeight: 1.15,
});

export const subtitle = style({
  fontSize: vars.font.sm,
  color: vars.color.muted,
  marginTop: vars.space.xs,
});

export const lede = style({
  fontSize: vars.font.xl,
  fontWeight: vars.weight.heading,
  letterSpacing: "-0.02em",
  lineHeight: 1.3,
  maxWidth: "36rem",
});

export const caption = style({
  fontSize: vars.font.sm,
  color: vars.color.muted,
  maxWidth: "40rem",
});

export const section = style({
  display: "flex",
  flexDirection: "column",
  gap: vars.space.md,
});

export const sectionTitle = style({
  fontSize: vars.font.md,
  fontWeight: vars.weight.heading,
  letterSpacing: "-0.01em",
});

export const cardGrid = style({
  display: "grid",
  gap: vars.space.lg,
});

export const split = style({
  display: "grid",
  gap: vars.space.xxl,
  "@media": {
    "screen and (min-width: 768px)": {
      gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
    },
  },
});

export const navRow = style({
  display: "flex",
  gap: vars.space.md,
  alignItems: "center",
});
