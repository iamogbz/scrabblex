import { cn } from "@/lib/utils";
import type { SVGProps } from "react";

export function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      className={cn("fill-current", props.className)}
      {...props}
    >
      <path d="M25,20 Q20,20 20,25 L20,75 Q20,80 25,80 L75,80 Q80,80 80,75 L80,25 Q80,20 75,20 Z" fill="none" />
      <text
        x="50"
        y="60"
        fontSize="50"
        fontFamily="Literata, serif"
        fontWeight="bold"
        textAnchor="middle"
        fill="currentColor"
      >
        L
      </text>
      <text
        x="72"
        y="78"
        fontSize="18"
        fontFamily="Literata, serif"
        fontWeight="bold"
t        textAnchor="middle"
        fill="currentColor"
      >
        x
      </text>
    </svg>
  );
}
