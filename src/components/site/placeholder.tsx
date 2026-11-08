import type { CSSProperties, ReactElement } from "react";

import { cn } from "@/lib/utils";

/** Pixel heights of the loaded UI per Tailwind breakpoint, measured with Playwright. */
export type PlaceholderHeights = {
  base: number;
  sm?: number;
  md?: number;
  lg?: number;
  xl?: number;
};

/** Holds the space a lazy demo will take, so nothing below it moves when it arrives. */
export function Placeholder({
  heights,
  className,
}: {
  heights: PlaceholderHeights;
  className?: string;
}): ReactElement {
  const sm = heights.sm ?? heights.base;
  const md = heights.md ?? sm;
  const lg = heights.lg ?? md;
  const xl = heights.xl ?? lg;
  const style = {
    "--h": `${heights.base}px`,
    "--h-sm": `${sm}px`,
    "--h-md": `${md}px`,
    "--h-lg": `${lg}px`,
    "--h-xl": `${xl}px`,
  } as CSSProperties;
  return (
    <div
      aria-hidden
      style={style}
      className={cn(
        "bg-muted/40 h-(--h) animate-pulse rounded-xl motion-reduce:animate-none sm:h-(--h-sm) md:h-(--h-md) lg:h-(--h-lg) xl:h-(--h-xl)",
        className,
      )}
    />
  );
}
