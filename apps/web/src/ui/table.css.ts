/**
 * 전체 폭 조회 테이블. 숫자는 오른쪽.
 */
import { style } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css.js";

export const tableWrap = style({
  width: "100%",
  overflowX: "auto",
});

export const tableHead = style({
  textAlign: "left",
  fontSize: vars.font.sm,
  fontWeight: vars.weight.medium,
  color: vars.color.muted,
  padding: `${vars.space.sm} 0`,
  borderBottom: `1px solid ${vars.color.border}`,
  verticalAlign: "bottom",
});

export const tableHeadNumeric = style({
  textAlign: "right",
  fontSize: vars.font.sm,
  fontWeight: vars.weight.medium,
  color: vars.color.muted,
  padding: `${vars.space.sm} 0`,
  borderBottom: `1px solid ${vars.color.border}`,
  verticalAlign: "bottom",
});

export const tableCell = style({
  textAlign: "left",
  fontSize: vars.font.sm,
  padding: `${vars.space.md} 0`,
  borderBottom: `1px solid ${vars.color.border}`,
  verticalAlign: "baseline",
});

export const tableCellNumeric = style({
  textAlign: "right",
  fontSize: vars.font.sm,
  fontFamily: vars.font.mono,
  padding: `${vars.space.md} 0`,
  borderBottom: `1px solid ${vars.color.border}`,
  verticalAlign: "baseline",
});

export const tableMono = style({
  fontFamily: vars.font.mono,
});

export const tableLink = style({
  textDecoration: "underline",
  textUnderlineOffset: "3px",
  selectors: {
    "&:hover": {
      color: vars.color.muted,
    },
  },
});

export const empty = style({
  fontSize: vars.font.sm,
  color: vars.color.muted,
});
