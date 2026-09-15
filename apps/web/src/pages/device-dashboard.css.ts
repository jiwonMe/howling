/**
 * 집 기기 현재값 격자. 상자는 쓰지 않고 열만 나눈다.
 */
import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { vars } from "../styles/theme.css.js";

export const board = style({
  display: "grid",
  gap: vars.space.xl,
  padding: `${vars.space.lg} 0`,
  borderTop: `1px solid ${vars.color.border}`,
  "@media": {
    "screen and (min-width: 640px)": {
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    },
    "screen and (min-width: 960px)": {
      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    },
  },
});

export const tile = recipe({
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: vars.space.xs,
    minWidth: 0,
    margin: 0,
    padding: 0,
    border: "none",
    background: "transparent",
    color: "inherit",
    font: "inherit",
    textAlign: "left",
    cursor: "pointer",
    selectors: {
      "&:hover": {
        backgroundColor: vars.color.hover,
      },
      "&:focus-visible": {
        outline: `2px solid ${vars.color.focus}`,
        outlineOffset: 4,
      },
    },
  },
  variants: {
    available: {
      true: {},
      false: { opacity: 0.55 },
    },
  },
  defaultVariants: {
    available: true,
  },
});

export const tileKind = style({
  fontSize: vars.font.sm,
  color: vars.color.muted,
});

export const tileName = style({
  fontSize: vars.font.sm,
  color: vars.color.text,
  overflowWrap: "anywhere",
});

export const tileState = recipe({
  base: {
    fontSize: vars.font.xl,
    fontWeight: vars.weight.heading,
    letterSpacing: "-0.02em",
    margin: 0,
  },
  variants: {
    live: {
      true: { color: vars.color.online },
      false: { color: vars.color.muted },
    },
  },
  defaultVariants: {
    live: false,
  },
});

export const tileReading = style({
  fontSize: vars.font.sm,
  color: vars.color.subtle,
  overflowWrap: "anywhere",
});

export const group = style({
  display: "flex",
  flexDirection: "column",
  gap: vars.space.xs,
});

export const groupTitle = style({
  fontSize: vars.font.md,
  fontWeight: vars.weight.heading,
  letterSpacing: "-0.01em",
  margin: 0,
});
