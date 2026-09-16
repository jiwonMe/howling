/**
 * 캔버스 카드. 왼쪽 띠 색으로 종류를, 두 번째 줄로 설정 상태를 알린다.
 */
import { createVar, globalStyle, style, styleVariants } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css.js";

export const accent = createVar();

export const card = style({
  vars: { [accent]: vars.color.borderStrong },
  position: "relative",
  width: "224px",
  border: `1px solid ${vars.color.borderStrong}`,
  borderLeft: `4px solid ${accent}`,
  borderRadius: vars.radius.md,
  backgroundColor: vars.color.surface,
  color: vars.color.text,
  padding: `${vars.space.sm} ${vars.space.md} ${vars.space.sm} ${vars.space.md}`,
  fontSize: vars.font.sm,
  display: "flex",
  flexDirection: "column",
  gap: vars.space.xs,
  boxShadow: "0 1px 2px rgba(0, 0, 0, 0.04)",
  transition: "box-shadow 120ms ease, border-color 120ms ease",
  selectors: {
    "&:hover": {
      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
    },
  },
});

export const cardSelected = style({
  borderColor: vars.color.focus,
  boxShadow: `0 0 0 2px ${vars.color.focus}`,
});

export const cardIncomplete = style({
  borderStyle: "dashed",
});

export const cardBranch = style({
  paddingRight: "44px",
});

export const cardJoin = style({
  paddingLeft: "40px",
  justifyContent: "center",
});

export const tone = styleVariants({
  start: { vars: { [accent]: "#0070f3" } },
  compute: { vars: { [accent]: "#7928ca" } },
  branch: { vars: { [accent]: "#f5a623" } },
  join: { vars: { [accent]: "#0a7f4a" } },
  time: { vars: { [accent]: "#8c8c8c" } },
  action: { vars: { [accent]: "#e00" } },
});

export const head = style({
  display: "flex",
  alignItems: "center",
  gap: vars.space.sm,
  minWidth: 0,
});

export const iconWrap = style({
  display: "inline-flex",
  color: accent,
  flexShrink: 0,
});

export const title = style({
  fontWeight: vars.weight.medium,
  fontSize: vars.font.sm,
  lineHeight: 1.3,
  flex: 1,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

export const idTag = style({
  fontFamily: vars.font.mono,
  fontSize: "11px",
  color: vars.color.subtle,
  flexShrink: 0,
});

export const summary = style({
  color: vars.color.muted,
  fontSize: "12px",
  lineHeight: 1.4,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

export const summaryIncomplete = style({
  color: vars.color.error,
});

export const portLabel = style({
  position: "absolute",
  fontSize: "11px",
  lineHeight: 1,
  color: vars.color.muted,
  transform: "translateY(-50%)",
  pointerEvents: "none",
  whiteSpace: "nowrap",
});

export const portLeft = style({ left: vars.space.sm });

export const portRight = style({ right: vars.space.sm });

globalStyle(`${card} .react-flow__handle`, {
  width: "10px",
  height: "10px",
  border: `2px solid ${vars.color.surface}`,
  backgroundColor: accent,
});

globalStyle(`${card} .react-flow__handle-left`, {
  left: "-7px",
});

globalStyle(`${card} .react-flow__handle-right`, {
  right: "-6px",
});
