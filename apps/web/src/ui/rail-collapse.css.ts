/**
 * 접힌 레일에서 글자를 숨기고 아이콘만 남긴다. 좁은 화면은 펼친 상태를 유지한다.
 */
import { style } from "@vanilla-extract/css";
import { vars } from "../styles/theme.css.js";
import { navLink, rail } from "./shell.css.js";

const collapsed = rail.classNames.variants.collapsed.true;
const desktop = "screen and (min-width: 768px)";

const hideOnCollapsed = {
  selectors: {
    [`${collapsed} &`]: {
      "@media": {
        [desktop]: {
          position: "absolute",
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: "hidden",
          clip: "rect(0, 0, 0, 0)",
          whiteSpace: "nowrap",
          border: 0,
        },
      },
    },
  },
} as const;

export const railHead = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: vars.space.xs,
  selectors: {
    [`${collapsed} &`]: {
      "@media": {
        [desktop]: {
          flexDirection: "column",
        },
      },
    },
  },
});

export const railToggle = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  width: 32,
  height: 32,
  border: "none",
  borderRadius: vars.radius.md,
  padding: 0,
  backgroundColor: "transparent",
  color: vars.color.muted,
  cursor: "pointer",
  selectors: {
    "&:hover": {
      color: vars.color.text,
      backgroundColor: vars.color.hover,
    },
    "&:focus-visible": {
      outline: `2px solid ${vars.color.focus}`,
      outlineOffset: 1,
    },
  },
});

export const railLabel = style(hideOnCollapsed);

export const railIconLink = style({
  selectors: {
    [`${collapsed} ${navLink.classNames.base}&`]: {
      "@media": {
        [desktop]: {
          justifyContent: "center",
          padding: vars.space.sm,
        },
      },
    },
  },
});

export const railStatusCompact = style({
  selectors: {
    [`${collapsed} &`]: {
      "@media": {
        [desktop]: {
          display: "flex",
          justifyContent: "center",
          gridTemplateColumns: "none",
        },
      },
    },
  },
});

export const railLogout = style({
  selectors: {
    [`${collapsed} &`]: {
      "@media": {
        [desktop]: {
          width: "100%",
          padding: vars.space.sm,
        },
      },
    },
  },
});
