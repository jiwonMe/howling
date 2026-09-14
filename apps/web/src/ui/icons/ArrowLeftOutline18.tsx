import type { SVGProps } from "react";

export type ArrowLeftOutline18Props = SVGProps<SVGSVGElement> & {
  strokeWidth?: number | string;
};

export function ArrowLeftOutline18({
  strokeWidth = 1.5,
  ...props
}: ArrowLeftOutline18Props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 18 18" {...props}><line x1="2.75" y1="9" x2="15.25" y2="9" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} data-color="color-2"></line><polyline points="7 13.25 2.75 9 7 4.75" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth}></polyline></svg>
  );
}
