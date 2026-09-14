/**
 * 상태·목록 카드.
 */
import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { vars } from "../styles/theme.css.js";

export const card = style({
  borderRadius: vars.radius.xl,
  border: `1px solid ${vars.color.border}`,
  backgroundColor: vars.color.surface,
  padding: vars.space.xl,
  display: "flex",
  flexDirection: "column",
  gap: vars.space.md,
});

export const cardTitle = style({
  fontSize: vars.font.sm,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: vars.color.subtle,
  margin: 0,
});

export const cardValue = recipe({
  base: {
    fontSize: vars.font.xl,
    fontWeight: 500,
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

export const cardDetail = style({
  fontSize: vars.font.sm,
  color: vars.color.subtle,
  margin: 0,
});
