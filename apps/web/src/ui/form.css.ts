/**
 * 입력. 라벨은 필드 밖, 테두리는 필드만.
 */
import { style } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css.js";

export const field = style({
  display: "flex",
  flexDirection: "column",
  gap: vars.space.xs,
});

export const label = style({
  fontSize: vars.font.sm,
  color: vars.color.muted,
});

export const input = style({
  borderRadius: vars.radius.md,
  border: `1px solid ${vars.color.borderStrong}`,
  backgroundColor: vars.color.bg,
  color: vars.color.text,
  padding: `${vars.space.sm} ${vars.space.md}`,
});

export const formStack = style({
  display: "flex",
  flexDirection: "column",
  gap: vars.space.lg,
  maxWidth: "28rem",
});

export const select = style({
  borderRadius: vars.radius.md,
  border: `1px solid ${vars.color.borderStrong}`,
  backgroundColor: vars.color.bg,
  color: vars.color.text,
  padding: `${vars.space.sm} ${vars.space.md}`,
});

export const errorText = style({
  color: vars.color.error,
  fontSize: vars.font.sm,
  margin: 0,
});
