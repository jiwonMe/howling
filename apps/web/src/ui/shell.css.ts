/**
 * 좌측 레일 + 본문. 편집기는 패딩을 줄여 캔버스를 남긴다.
 */
import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { vars } from "../styles/theme.css.js";

export const skipLink = style({
  position: "absolute",
  left: vars.space.lg,
  top: 0,
  transform: "translateY(-120%)",
  backgroundColor: vars.color.bg,
  color: vars.color.text,
  padding: `${vars.space.sm} ${vars.space.md}`,
  zIndex: 2,
  selectors: {
    "&:focus": {
      transform: "none",
    },
  },
});

export const shell = style({
  minHeight: "100vh",
  display: "flex",
  backgroundColor: vars.color.bg,
  color: vars.color.text,
  "@media": {
    "screen and (max-width: 767px)": {
      flexDirection: "column",
    },
  },
});

export const rail = style({
  width: "220px",
  flexShrink: 0,
  display: "flex",
  flexDirection: "column",
  gap: vars.space.xl,
  padding: `${vars.space.xl} ${vars.space.lg}`,
  borderRight: `1px solid ${vars.color.border}`,
  "@media": {
    "screen and (max-width: 767px)": {
      width: "auto",
      borderRight: "none",
      borderBottom: `1px solid ${vars.color.border}`,
      padding: vars.space.lg,
      gap: vars.space.md,
    },
  },
});

export const brand = style({
  display: "flex",
  alignItems: "center",
  gap: vars.space.sm,
  fontSize: vars.font.md,
  fontWeight: vars.weight.heading,
  letterSpacing: "-0.02em",
});

export const nav = style({
  display: "flex",
  flexDirection: "column",
  gap: vars.space.xs,
  "@media": {
    "screen and (max-width: 767px)": {
      flexDirection: "row",
      flexWrap: "wrap",
    },
  },
});

export const navLink = recipe({
  base: {
    display: "flex",
    alignItems: "center",
    gap: vars.space.sm,
    padding: `${vars.space.sm} ${vars.space.md}`,
    borderRadius: vars.radius.md,
    color: vars.color.muted,
    fontSize: vars.font.sm,
  },
  variants: {
    active: {
      true: {
        color: vars.color.text,
        backgroundColor: vars.color.hover,
      },
      false: {
        selectors: {
          "&:hover": {
            color: vars.color.text,
          },
        },
      },
    },
  },
  defaultVariants: {
    active: false,
  },
});

export const railMeta = style({
  marginTop: "auto",
  display: "flex",
  flexDirection: "column",
  gap: vars.space.sm,
  fontSize: vars.font.sm,
  color: vars.color.subtle,
});

export const railId = style({
  fontFamily: vars.font.mono,
  fontSize: vars.font.sm,
  color: vars.color.muted,
  overflowWrap: "anywhere",
});

export const stage = recipe({
  base: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
  },
  variants: {
    density: {
      page: {
        padding: `${vars.space.xxl} 40px ${vars.space.xxl}`,
        gap: vars.space.xl,
      },
      editor: {
        padding: `${vars.space.lg} ${vars.space.xl}`,
        gap: vars.space.md,
        minHeight: 0,
      },
    },
  },
  defaultVariants: {
    density: "page",
  },
});

export const main = style({
  display: "flex",
  flexDirection: "column",
  gap: "inherit",
  minWidth: 0,
  flex: 1,
});
