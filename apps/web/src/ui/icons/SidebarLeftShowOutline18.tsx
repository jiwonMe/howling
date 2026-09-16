import type { SVGProps } from "react";

export type SidebarLeftShowOutline18Props = SVGProps<SVGSVGElement> & {
  strokeWidth?: number | string;
};

export function SidebarLeftShowOutline18({
  strokeWidth = 1.5,
  ...props
}: SidebarLeftShowOutline18Props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 18 18" {...props}><line x1="6.25" y1="2.75" x2="6.25" y2="15.25" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} data-color="color-2"></line><polyline points="10.25 6.5 12.75 9 10.25 11.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} data-color="color-2"></polyline><rect x="1.75" y="2.75" width={14.5} height={12.5} rx="2" ry="2" transform="translate(18 18) rotate(180)" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth}></rect></svg>
  );
}
