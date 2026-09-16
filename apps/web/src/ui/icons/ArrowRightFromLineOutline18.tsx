import type { SVGProps } from "react";

export type ArrowRightFromLineOutline18Props = SVGProps<SVGSVGElement> & {
  strokeWidth?: number | string;
};

export function ArrowRightFromLineOutline18({
  strokeWidth = 1.5,
  ...props
}: ArrowRightFromLineOutline18Props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 18 18" {...props}><polyline points="11.25 5 15.25 9 11.25 13" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth}></polyline><line x1="15.25" y1="9" x2="5.75" y2="9" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth}></line><line x1="2.75" y1="2.75" x2="2.75" y2="15.25" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} data-color="color-2"></line></svg>
  );
}
