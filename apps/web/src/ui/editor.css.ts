/**
 * 캔버스가 스테이지를 채우고, 도구는 위에 떠 있다.
 */
import { globalStyle, style } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css.js";

export const editorStage = style({
  position: "relative",
  flex: 1,
  minWidth: 0,
  minHeight: 0,
  width: "100%",
  height: "100%",
  overflow: "hidden",
  backgroundColor: vars.color.hover,
});

export const canvasWrap = style({
  position: "absolute",
  inset: 0,
  overflow: "hidden",
  backgroundColor: vars.color.hover,
});

export const floatBar = style({
  position: "absolute",
  top: vars.space.lg,
  left: vars.space.lg,
  right: vars.space.lg,
  zIndex: 10,
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: vars.space.md,
  pointerEvents: "none",
});

export const floatCluster = style({
  pointerEvents: "auto",
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: vars.space.sm,
  padding: `${vars.space.sm} ${vars.space.md}`,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  backgroundColor: vars.color.bg,
  boxShadow: "0 1px 2px rgba(0, 0, 0, 0.04), 0 8px 24px rgba(0, 0, 0, 0.06)",
});

export const floatTitle = style({
  fontSize: vars.font.xl,
  fontWeight: vars.weight.heading,
  letterSpacing: "-0.02em",
  lineHeight: 1.2,
});

export const toolbar = style({
  display: "flex",
  flexWrap: "wrap",
  gap: vars.space.sm,
  pointerEvents: "auto",
});

const floatSide = {
  pointerEvents: "auto",
  position: "absolute",
  zIndex: 10,
  top: "88px",
  width: "200px",
  maxHeight: "calc(100% - 104px)",
  overflow: "auto",
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  backgroundColor: vars.color.bg,
  boxShadow: "0 1px 2px rgba(0, 0, 0, 0.04), 0 8px 24px rgba(0, 0, 0, 0.06)",
  padding: vars.space.md,
  display: "flex",
  flexDirection: "column",
  gap: vars.space.sm,
} as const;

export const panelHead = style({
  display: "flex",
  flexDirection: "column",
  gap: vars.space.xs,
  paddingBottom: vars.space.sm,
  borderBottom: `1px solid ${vars.color.border}`,
});

export const panelTitleRow = style({
  display: "flex",
  alignItems: "center",
  gap: vars.space.sm,
});

export const panelMono = style({
  fontFamily: vars.font.mono,
  fontSize: "11px",
  color: vars.color.subtle,
});

export const panelSection = style({
  display: "flex",
  flexDirection: "column",
  gap: vars.space.sm,
});

export const dangerButton = style({
  color: vars.color.error,
  borderColor: vars.color.border,
});

export const emptyHint = style({
  position: "absolute",
  top: 0,
  bottom: 0,
  left: "248px",
  right: "328px",
  margin: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  pointerEvents: "none",
  color: vars.color.muted,
  fontSize: vars.font.md,
  lineHeight: 1.6,
  textAlign: "center",
  padding: vars.space.xl,
  zIndex: 5,
});

export const toolbarGroup = style({
  display: "flex",
  alignItems: "center",
  gap: vars.space.xs,
  paddingRight: vars.space.sm,
  borderRight: `1px solid ${vars.color.border}`,
  selectors: {
    "&:last-child": {
      paddingRight: 0,
      borderRight: "none",
    },
  },
});

export const toolbarToggle = style({
  display: "inline-flex",
  alignItems: "center",
  gap: vars.space.xs,
  fontSize: vars.font.sm,
  color: vars.color.muted,
  cursor: "pointer",
});

export const sidebar = style({
  ...floatSide,
  right: vars.space.lg,
  width: "280px",
  gap: vars.space.md,
});

export const floatNote = style({
  pointerEvents: "auto",
  position: "absolute",
  zIndex: 10,
  left: "50%",
  bottom: vars.space.lg,
  transform: "translateX(-50%)",
  maxWidth: "36rem",
  padding: `${vars.space.sm} ${vars.space.md}`,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  backgroundColor: vars.color.bg,
  boxShadow: "0 1px 2px rgba(0, 0, 0, 0.04), 0 8px 24px rgba(0, 0, 0, 0.06)",
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

globalStyle(`${editorStage} .react-flow__panel.react-flow__controls.bottom.left`, {
  left: "232px",
  bottom: "16px",
  margin: 0,
});

globalStyle(`${editorStage} .react-flow__attribution`, {
  background: "transparent",
});

globalStyle(`${editorStage} .react-flow__edge-path`, {
  stroke: vars.color.borderStrong,
  strokeWidth: 1.5,
});

globalStyle(`${editorStage} .react-flow__edge.selected .react-flow__edge-path`, {
  stroke: vars.color.focus,
  strokeWidth: 2,
});

globalStyle(`${editorStage} .react-flow__edge-textbg`, {
  fill: vars.color.bg,
});

globalStyle(`${editorStage} .react-flow__edge-text`, {
  fill: vars.color.muted,
  fontSize: "11px",
});
