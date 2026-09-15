import type { SVGProps } from "react";

export type HistoryOutline18Props = SVGProps<SVGSVGElement> & {
  strokeWidth?: number | string;
};

export function HistoryOutline18({
  strokeWidth = 1.5,
  ...props
}: HistoryOutline18Props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 18 18" {...props}>
      <path
        d="M1.75281 9.20209C1.85991 13.1127 5.0636 16.25 9 16.25C13.004 16.25 16.25 13.004 16.25 9C16.25 4.996 13.004 1.75 9 1.75C5.9995 1.75 3.42531 3.57271 2.32321 6.17041"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M1.88 3.30499L2.28799 6.25L5.23199 5.84302"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M9 4.75V9L12.25 11.25"
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
