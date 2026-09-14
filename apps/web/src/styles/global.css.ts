/**
 * 문서 기본 스타일.
 */
import { globalStyle } from "@vanilla-extract/css";
import { vars } from "./theme.css.js";

globalStyle("html, body, #root", {
  minHeight: "100%",
});

globalStyle("body", {
  margin: 0,
  backgroundColor: vars.color.bg,
  color: vars.color.text,
  fontFamily: vars.font.sans,
});

globalStyle("a", {
  color: "inherit",
});

globalStyle("button, input, textarea, select", {
  font: "inherit",
});
