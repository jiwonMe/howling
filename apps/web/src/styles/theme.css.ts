/**
 * 단계 0 zinc 팔레트를 Vanilla Extract 토큰으로 고정한다.
 */
import { createTheme } from "@vanilla-extract/css";

export const [themeClass, vars] = createTheme({
  color: {
    bg: "#09090b",
    text: "#f4f4f5",
    muted: "#a1a1aa",
    subtle: "#71717a",
    border: "#27272a",
    borderStrong: "#3f3f46",
    hover: "#18181b",
    online: "#34d399",
    error: "#fca5a5",
    surface: "#09090b",
  },
  space: {
    xs: "4px",
    sm: "8px",
    md: "12px",
    lg: "16px",
    xl: "24px",
    xxl: "32px",
  },
  radius: {
    md: "6px",
    xl: "12px",
  },
  font: {
    sans: "ui-sans-serif, system-ui, sans-serif",
    sm: "14px",
    md: "16px",
    xl: "20px",
    xxl: "24px",
  },
});
