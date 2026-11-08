import type { ComponentProps, ReactElement } from "react";

import { siteConfig } from "../../../config/site";

export function Mark(props: ComponentProps<"svg">): ReactElement {
  return (
    <svg
      viewBox="0 0 20 20"
      width={20}
      height={20}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <rect x={1.5} y={1.5} width={17} height={17} rx={3.5} />
      <path d="M4.5 13h2.5V7h3v6h3V7h2.5" />
    </svg>
  );
}

export function Wordmark(): ReactElement {
  return (
    <span className="inline-flex items-center gap-2">
      <Mark className="text-foreground size-6" />
      <span className="text-[17px] leading-none font-semibold tracking-tight">
        {siteConfig.name}
      </span>
    </span>
  );
}
