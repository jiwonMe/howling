import type { SVGProps } from "react";

export type MergeOutline18Props = SVGProps<SVGSVGElement> & {
  strokeWidth?: number | string;
};

export function MergeOutline18({
  strokeWidth = 1.5,
  ...props
}: MergeOutline18Props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 18 18" {...props}><path d="M9.5,9l-2.172-3.752c-.358-.618-1.017-.998-1.731-.998H2.75" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} data-color="color-2"></path><path d="M9.5,9l-2.172,3.752c-.358,.618-1.017,.998-1.731,.998H2.75" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} data-color="color-2"></path><line x1="16.25" y1="9" x2="9.5" y2="9" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} data-color="color-2"></line><polyline points="13.5 6.25 16.25 9 13.5 11.75" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth}></polyline></svg>
  );
}
