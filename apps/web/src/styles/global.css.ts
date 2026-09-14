/**
 * 문서 기본. 계층은 타이포가 먼저 만들고 상자로는 고치지 않는다.
 */
import { globalStyle } from "@vanilla-extract/css";
import { vars } from "./theme.css.js";

globalStyle("html, body, #root", {
  height: "100%",
  minHeight: "100%",
});

globalStyle("body", {
  margin: 0,
  backgroundColor: vars.color.bg,
  color: vars.color.text,
  fontFamily: vars.font.sans,
  fontSize: vars.font.md,
  fontWeight: vars.weight.regular,
  lineHeight: 1.5,
});

globalStyle("h1, h2, h3, p, ul, ol, figure, table", {
  margin: 0,
});

globalStyle("a", {
  color: "inherit",
  textDecoration: "none",
});

globalStyle("button, input, textarea, select", {
  font: "inherit",
});

globalStyle(":focus-visible", {
  outline: `2px solid ${vars.color.focus}`,
  outlineOffset: "2px",
});

globalStyle("table", {
  width: "100%",
  borderCollapse: "collapse",
  fontVariantNumeric: "tabular-nums",
});
