import type { SVGProps } from "react";

export function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 50"
      width="120"
      height="30"
      aria-label="InsightFlow Logo"
      {...props}
    >
      <defs>
        <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop
            offset="0%"
            style={{ stopColor: "hsl(var(--primary))", stopOpacity: 1 }}
          />

          <stop
            offset="100%"
            style={{ stopColor: "hsl(var(--accent))", stopOpacity: 1 }}
          />
        </linearGradient>
      </defs>
      <path
        d="M10 40 Q15 10 20 40 Q25 10 30 40"
        stroke="url(#logoGradient)"
        fill="transparent"
        strokeWidth="3"
      />

      <path
        d="M35 40 Q40 10 45 40 Q50 10 55 40"
        stroke="url(#logoGradient)"
        fill="transparent"
        strokeWidth="3"
      />

      <text
        x="70"
        y="35"
        fontFamily="var(--font-geist-sans), system-ui, sans-serif"
        fontSize="30"
        fontWeight="bold"
        fill="hsl(var(--foreground))"
      >
        InsightFlow
      </text>
    </svg>
  );
}
