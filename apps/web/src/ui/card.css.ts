/**
 * 편집기 보조 패널 제목. 전면 카드 격자는 쓰지 않는다.
 */
import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { vars } from "../styles/theme.css.js";

export const card = style({
  borderRadius: vars.radius.md,
  border: `1px solid ${vars.color.border}`,
  backgroundColor: vars.color.surface,
  padding: vars.space.lg,
  display: "flex",
  flexDirection: "column",
  gap: vars.space.md,
});

export const cardTitle = style({
  fontSize: vars.font.sm,
  fontWeight: vars.weight.medium,
  color: vars.color.muted,
  margin: 0,
});

export const cardValue = recipe({
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

export const cardDetail = style({
  fontSize: vars.font.sm,
  color: vars.color.subtle,
  margin: 0,
  fontFamily: vars.font.mono,
});
