/**
 * 공통 버튼 recipe.
 */
import { recipe } from "@vanilla-extract/recipes";
import { vars } from "../styles/theme.css.js";

export const buttonRecipe = recipe({
  base: {
    borderRadius: vars.radius.md,
    border: `1px solid ${vars.color.borderStrong}`,
    padding: `${vars.space.sm} ${vars.space.md}`,
    fontSize: vars.font.sm,
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
        backgroundColor: vars.color.hover,
      },
    },
  },
  defaultVariants: {
    intent: "default",
  },
});
