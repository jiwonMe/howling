/**
 * 동등한 KPI. 상자는 쓰지 않고 열만 나눈다.
 */
import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { vars } from "../styles/theme.css.js";

export const statStrip = recipe({
  base: {
    display: "grid",
    gap: vars.space.xl,
    padding: `${vars.space.lg} 0`,
    borderTop: `1px solid ${vars.color.border}`,
    borderBottom: `1px solid ${vars.color.border}`,
  },
  variants: {
    columns: {
      two: {
        "@media": {
          "screen and (min-width: 768px)": {
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          },
        },
      },
      three: {
        "@media": {
          "screen and (min-width: 768px)": {
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          },
        },
      },
    },
  },
  defaultVariants: {
    columns: "three",
  },
});

export const stat = style({
  display: "flex",
  flexDirection: "column",
  gap: vars.space.xs,
  minWidth: 0,
});

export const statLabel = style({
  fontSize: vars.font.sm,
  color: vars.color.muted,
});

export const statValue = recipe({
  base: {
    fontSize: vars.font.xl,
    fontWeight: vars.weight.heading,
    letterSpacing: "-0.02em",
    margin: 0,
  },
  variants: {
    online: {
      true: { color: vars.color.online },
      false: { color: vars.color.muted },
    },
  },
  defaultVariants: {
    online: false,
  },
});

export const statDetail = style({
  fontSize: vars.font.sm,
  color: vars.color.subtle,
  fontFamily: vars.font.mono,
  overflowWrap: "anywhere",
});
