/**
 * 기본은 테두리만. primary는 전경/배경을 뒤집는다.
 */
import { recipe } from "@vanilla-extract/recipes";
import { vars } from "../styles/theme.css.js";

export const buttonRecipe = recipe({
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: vars.space.sm,
    borderRadius: vars.radius.md,
    border: `1px solid ${vars.color.borderStrong}`,
    padding: `${vars.space.sm} ${vars.space.md}`,
    fontSize: vars.font.sm,
    fontWeight: vars.weight.medium,
    backgroundColor: "transparent",
    color: vars.color.text,
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
  },
  variants: {
    intent: {
      default: {},
      primary: {
        backgroundColor: vars.color.text,
        color: vars.color.bg,
        borderColor: vars.color.text,
        selectors: {
          "&:hover": {
            backgroundColor: vars.color.text,
            opacity: 0.88,
          },
        },
      },
    },
  },
  defaultVariants: {
    intent: "default",
  },
});
