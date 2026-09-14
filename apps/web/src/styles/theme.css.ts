/**
 * Geist 계열 토큰. 라이트 기본, 시스템 다크는 prefers-color-scheme.
 */
import { assignVars, createThemeContract, globalStyle } from "@vanilla-extract/css";

export const vars = createThemeContract({
  color: {
    bg: null,
    text: null,
    muted: null,
    subtle: null,
    border: null,
    borderStrong: null,
    hover: null,
    online: null,
    error: null,
    surface: null,
    focus: null,
  },
  space: {
    xs: null,
    sm: null,
    md: null,
    lg: null,
    xl: null,
    xxl: null,
  },
  radius: {
    md: null,
    xl: null,
  },
  font: {
    sans: null,
    mono: null,
    sm: null,
    md: null,
    xl: null,
    xxl: null,
  },
  weight: {
    regular: null,
    medium: null,
    heading: null,
  },
});

const rhythm = {
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
    xl: "6px",
  },
  font: {
    sans: '"Geist", "Noto Sans KR", "Apple SD Gothic Neo", ui-sans-serif, system-ui, sans-serif',
    mono: '"Geist Mono", ui-monospace, SFMono-Regular, monospace',
    sm: "13px",
    md: "16px",
    xl: "20px",
    xxl: "32px",
  },
  weight: {
    regular: "400",
    medium: "500",
    heading: "600",
  },
} as const;

const light = {
  color: {
    bg: "#ffffff",
    text: "#000000",
    muted: "#666666",
    subtle: "#8c8c8c",
    border: "#ebebeb",
    borderStrong: "#d6d6d6",
    hover: "#f5f5f5",
    online: "#0a7f4a",
    error: "#e00",
    surface: "#ffffff",
    focus: "#0070f3",
  },
  ...rhythm,
};

const dark = {
  color: {
    bg: "#000000",
    text: "#ededed",
    muted: "#a1a1a1",
    subtle: "#8a8a8a",
    border: "#2e2e2e",
    borderStrong: "#444444",
    hover: "#111111",
    online: "#46a758",
    error: "#ff6369",
    surface: "#000000",
    focus: "#0070f3",
  },
  ...rhythm,
};

globalStyle(":root", {
  vars: assignVars(vars, light),
  colorScheme: "light dark",
});

globalStyle(":root", {
  "@media": {
    "(prefers-color-scheme: dark)": {
      vars: assignVars(vars, dark),
    },
  },
});
