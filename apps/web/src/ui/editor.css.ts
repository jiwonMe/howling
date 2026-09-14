/**
 * 편집기 3열. 테두리는 구역을 나눌 때만 쓴다.
 */
import { style } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css.js";

export const toolbar = style({
  display: "flex",
  flexWrap: "wrap",
  gap: vars.space.sm,
});

export const editorShell = style({
  display: "grid",
  gridTemplateColumns: "180px minmax(0, 1fr) 280px",
  gap: vars.space.md,
  flex: 1,
  minHeight: "480px",
});

export const palette = style({
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  padding: vars.space.md,
  display: "flex",
  flexDirection: "column",
  gap: vars.space.sm,
});

export const canvasWrap = style({
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  overflow: "hidden",
  backgroundColor: vars.color.hover,
  minHeight: "480px",
  height: "100%",
});

export const sidebar = style({
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  padding: vars.space.md,
  display: "flex",
  flexDirection: "column",
  gap: vars.space.md,
});

export const list = style({
  display: "flex",
  flexDirection: "column",
  gap: vars.space.md,
});

export const flowNode = style({
  minWidth: "160px",
  border: `1px solid ${vars.color.borderStrong}`,
  borderRadius: vars.radius.md,
  backgroundColor: vars.color.surface,
  color: vars.color.text,
  padding: vars.space.md,
  fontSize: vars.font.sm,
});

export const muted = style({
  color: vars.color.muted,
  fontSize: vars.font.sm,
});
