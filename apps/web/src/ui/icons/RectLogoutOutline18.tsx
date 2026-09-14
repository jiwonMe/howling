import type { SVGProps } from "react";

export type RectLogoutOutline18Props = SVGProps<SVGSVGElement> & {
  strokeWidth?: number | string;
};

export function RectLogoutOutline18({
  strokeWidth = 1.5,
  ...props
}: RectLogoutOutline18Props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 18 18" {...props}><path d="M6.25,5.75v-1.5c0-1.105,.895-2,2-2h5.5c1.105,0,2,.895,2,2V13.75c0,1.105-.895,2-2,2h-5.5c-1.105,0-2-.895-2-2v-1.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth}></path><polyline points="3.5 11.75 .75 9 3.5 6.25" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} data-color="color-2"></polyline><line x1=".75" y1="9" x2="9.25" y2="9" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} data-color="color-2"></line></svg>
  );
}
