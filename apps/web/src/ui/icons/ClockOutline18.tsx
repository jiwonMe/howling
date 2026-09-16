import type { SVGProps } from "react";

export type ClockOutline18Props = SVGProps<SVGSVGElement> & {
  strokeWidth?: number | string;
};

export function ClockOutline18({
  strokeWidth = 1.5,
  ...props
}: ClockOutline18Props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 18 18" {...props}><circle cx="9" cy="9" r="7.25" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth}></circle><polyline points="9 4.75 9 9 12.25 11.25" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} data-color="color-2"></polyline></svg>
  );
}
