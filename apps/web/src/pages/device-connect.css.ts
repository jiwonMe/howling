/**
 * 기기 연결 목록. 한 줄에 이름, 아래에 짧은 설명.
 */
import { style } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css.js";

export const choiceList = style({
  display: "flex",
  flexDirection: "column",
  gap: vars.space.xs,
  maxHeight: "22rem",
  overflow: "auto",
});

export const choice = style({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: vars.space.xs,
  width: "100%",
  textAlign: "left",
  borderRadius: vars.radius.md,
  border: `1px solid ${vars.color.border}`,
  backgroundColor: vars.color.bg,
  color: vars.color.text,
  padding: `${vars.space.sm} ${vars.space.md}`,
  cursor: "pointer",
  selectors: {
    "&:hover": {
      backgroundColor: vars.color.hover,
    },
    "&:disabled": {
      opacity: 0.5,
      cursor: "not-allowed",
    },
  },
});

export const choiceName = style({
  fontWeight: vars.weight.medium,
});

export const choiceHint = style({
  fontSize: vars.font.sm,
  color: vars.color.muted,
});
