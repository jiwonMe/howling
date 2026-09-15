import type { SVGProps } from "react";

export type ChartLineOutline18Props = SVGProps<SVGSVGElement> & {
  strokeWidth?: number | string;
};

export function ChartLineOutline18({
  strokeWidth = 1.5,
  ...props
}: ChartLineOutline18Props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 18 18" {...props}>
      <path
        d="M2.75 14.25V4.75"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M2.75 14.25H15.25"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M5.25 11.25L8.25 7.75L10.75 9.75L14.25 5.25"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        data-color="color-2"
        fill="none"
      />
    </svg>
  );
}
