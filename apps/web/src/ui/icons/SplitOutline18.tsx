import type { SVGProps } from "react";

export type SplitOutline18Props = SVGProps<SVGSVGElement> & {
  strokeWidth?: number | string;
};

export function SplitOutline18({
  strokeWidth = 1.5,
  ...props
}: SplitOutline18Props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 18 18" {...props}><path d="M6,9l2.159,3.337c.369,.57,1.001,.913,1.679,.913h5.412" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} data-color="color-2"></path><path d="M6,9l2.159-3.337c.369-.57,1.001-.913,1.679-.913h5.412" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} data-color="color-2"></path><line x1="1.75" y1="9" x2="6" y2="9" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} data-color="color-2"></line><polyline points="12.5 10.5 15.25 13.25 12.5 16" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth}></polyline><polyline points="12.5 2 15.25 4.75 12.5 7.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth}></polyline></svg>
  );
}
