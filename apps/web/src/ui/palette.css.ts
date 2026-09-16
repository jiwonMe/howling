/**
 * 노드 팔레트. 검색 한 줄 + 한 줄짜리 항목. 설명은 title로만.
 */
import { style } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css.js";

export const PALETTE_WIDTH = 200;

export const palette = style({
  pointerEvents: "auto",
  position: "absolute",
  zIndex: 10,
  top: "88px",
  left: vars.space.lg,
  width: `${String(PALETTE_WIDTH)}px`,
  maxHeight: "calc(100% - 104px)",
  display: "flex",
  flexDirection: "column",
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  backgroundColor: vars.color.bg,
  boxShadow: "0 1px 2px rgba(0, 0, 0, 0.04), 0 8px 24px rgba(0, 0, 0, 0.06)",
  overflow: "hidden",
});

export const searchRow = style({
  display: "flex",
  alignItems: "center",
  gap: vars.space.xs,
  padding: `${vars.space.xs} ${vars.space.sm}`,
  borderBottom: `1px solid ${vars.color.border}`,
  color: vars.color.subtle,
});

export const searchInput = style({
  flex: 1,
  minWidth: 0,
  border: "none",
  outline: "none",
  background: "transparent",
  color: vars.color.text,
  font: "inherit",
  fontSize: vars.font.sm,
  padding: `${vars.space.xs} 0`,
  selectors: {
    "&::placeholder": { color: vars.color.subtle },
  },
});

export const clearButton = style({
  display: "inline-flex",
  border: "none",
  background: "transparent",
  padding: 0,
  color: vars.color.subtle,
  cursor: "pointer",
  selectors: {
    "&:hover": { color: vars.color.text },
    "&:focus-visible": {
      outline: `2px solid ${vars.color.focus}`,
      outlineOffset: "1px",
      borderRadius: "2px",
    },
  },
});

export const list = style({
  display: "flex",
  flexDirection: "column",
  padding: vars.space.xs,
  overflow: "auto",
  minHeight: 0,
});

export const item = style({
  display: "flex",
  alignItems: "center",
  gap: vars.space.sm,
  width: "100%",
  textAlign: "left",
  border: "1px solid transparent",
  borderRadius: vars.radius.md,
  padding: `5px ${vars.space.sm}`,
  backgroundColor: "transparent",
  color: vars.color.text,
  cursor: "pointer",
  font: "inherit",
  fontSize: vars.font.sm,
  lineHeight: 1.3,
  selectors: {
    "&:hover": {
      backgroundColor: vars.color.hover,
      borderColor: vars.color.border,
    },
    "&:focus-visible": {
      outline: `2px solid ${vars.color.focus}`,
      outlineOffset: "-1px",
    },
  },
});

export const itemIcon = style({
  display: "inline-flex",
  flexShrink: 0,
});

export const itemLabel = style({
  flex: 1,
  minWidth: 0,
  fontWeight: vars.weight.medium,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
});

export const itemTag = style({
  flexShrink: 0,
  fontSize: "11px",
  color: vars.color.subtle,
});

export const footNote = style({
  margin: 0,
  padding: `${vars.space.xs} ${vars.space.md} ${vars.space.sm}`,
  fontSize: "11px",
  lineHeight: 1.4,
  color: vars.color.subtle,
});
