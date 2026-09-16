import type { SVGProps } from "react";

export type XmarkOutline18Props = SVGProps<SVGSVGElement> & {
  strokeWidth?: number | string;
};

export function XmarkOutline18({
  strokeWidth = 1.5,
  ...props
}: XmarkOutline18Props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 18 18" {...props}><line x1="14" y1="4" x2="4" y2="14" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} data-color="color-2"></line><line x1="4" y1="4" x2="14" y2="14" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth}></line></svg>
  );
}
