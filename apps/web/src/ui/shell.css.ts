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
  height: "100vh",
  display: "flex",
  overflow: "hidden",
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

export const railFoot = style({
  marginTop: "auto",
  display: "flex",
  flexDirection: "column",
  gap: vars.space.md,
});

export const railStatus = style({
  display: "flex",
  flexDirection: "column",
  gap: 2,
  paddingTop: vars.space.md,
  borderTop: `1px solid ${vars.color.border}`,
  "@media": {
    "screen and (max-width: 767px)": {
      flexDirection: "row",
      flexWrap: "wrap",
      columnGap: vars.space.md,
      rowGap: vars.space.xs,
      paddingTop: vars.space.sm,
    },
  },
});

export const railStatusRow = style({
  display: "grid",
  gridTemplateColumns: "6px 52px minmax(0, 1fr)",
  alignItems: "center",
  columnGap: vars.space.sm,
  minWidth: 0,
  margin: 0,
  fontSize: "11px",
  lineHeight: "16px",
  color: vars.color.muted,
  "@media": {
    "screen and (max-width: 767px)": {
      display: "flex",
      gridTemplateColumns: "none",
    },
  },
});

export const railDot = recipe({
  base: {
    width: 6,
    height: 6,
    borderRadius: "999px",
    justifySelf: "center",
    flexShrink: 0,
  },
  variants: {
    ok: {
      true: { backgroundColor: vars.color.online },
      false: { backgroundColor: vars.color.subtle },
    },
  },
  defaultVariants: {
    ok: false,
  },
});

export const railStatusValue = recipe({
  base: {
    fontFamily: vars.font.mono,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  variants: {
    ok: {
      true: { color: vars.color.online },
      false: { color: vars.color.subtle },
    },
  },
  defaultVariants: {
    ok: false,
  },
});

export const railMeta = style({
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
        overflow: "auto",
      },
      editor: {
        padding: 0,
        gap: 0,
        minHeight: 0,
        overflow: "hidden",
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
  minHeight: 0,
  flex: 1,
});
