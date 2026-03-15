import * as React from "react";

type XLogoProps = React.SVGProps<SVGSVGElement> & {
  size?: number;
};

export function XLogo({ size = 24, ...props }: XLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M18.244 2H21.5l-7.52 8.59L22 22h-6.68l-5.23-6.53L4.5 22H1.2l8.04-9.18L2 2h6.86l4.73 5.9L18.244 2z" />
    </svg>
  );
}
