/**
 * 기기 동작 대화상자. entity_id 입력은 없다.
 */
import { style } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css.js";

export const dialog = style({
  border: `1px solid ${vars.color.borderStrong}`,
  borderRadius: vars.radius.md,
  backgroundColor: vars.color.surface,
  color: vars.color.text,
  padding: vars.space.xl,
  width: "min(28rem, calc(100% - 2rem))",
  maxWidth: "28rem",
  boxShadow: "none",
  selectors: {
    "&::backdrop": {
      backgroundColor: "rgba(0, 0, 0, 0.32)",
    },
  },
});

export const dialogTitle = style({
  fontSize: vars.font.xl,
  fontWeight: vars.weight.heading,
  letterSpacing: "-0.02em",
  margin: 0,
});

export const dialogNow = style({
  fontSize: vars.font.xl,
  fontWeight: vars.weight.heading,
  margin: 0,
});

export const quickRow = style({
  display: "flex",
  flexWrap: "wrap",
  gap: vars.space.sm,
});
