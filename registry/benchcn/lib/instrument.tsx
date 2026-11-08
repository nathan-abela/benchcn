// benchcn.dev · instrument
// Shared chrome for bench instruments: the bezel, engraved labels and numeric readouts, plus the
// reduced-motion query every instrument respects.
import {
  type ComponentProps,
  type ReactElement,
  type ReactNode,
  useSyncExternalStore,
} from "react";

import { cn } from "@/lib/utils";

export const INSTRUMENT_FRAME =
  "bg-card text-card-foreground flex flex-col gap-3 rounded-xl border p-3 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.05),0_1px_2px_rgb(0_0_0/0.25)]";

export function InstrumentFrame({ className, ...props }: ComponentProps<"div">): ReactElement {
  return <div data-slot="instrument" className={cn(INSTRUMENT_FRAME, className)} {...props} />;
}

export function InstrumentLabel({ className, ...props }: ComponentProps<"span">): ReactElement {
  return (
    <span
      data-slot="instrument-label"
      className={cn("text-muted-foreground text-xs leading-none", className)}
      {...props}
    />
  );
}

export type ReadoutProps = ComponentProps<"div"> & {
  label: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
};

export function Readout({ label, value, unit, className, ...props }: ReadoutProps): ReactElement {
  return (
    <div data-slot="readout" className={cn("flex min-w-0 flex-col gap-1", className)} {...props}>
      <InstrumentLabel>{label}</InstrumentLabel>
      <span className="text-sm leading-none font-medium tabular-nums">
        {value}
        {unit ? <span className="text-muted-foreground ml-1 text-xs">{unit}</span> : null}
      </span>
    </div>
  );
}

/** Colour of channel `n` (1-based): the benchcn channel token, falling back to the shadcn chart token. */
export function channelToken(n: number): string {
  const i = ((n - 1) % 5) + 1;
  return `var(--channel-${i}, var(--chart-${i}))`;
}

/** Resolves `var(--x)` and `var(--x, fallback)` against computed styles so canvas code can use it. */
export function resolveCssColor(styles: CSSStyleDeclaration, color: string): string {
  const match = /^var\((--[\w-]+)(?:\s*,\s*(.+))?\)$/.exec(color.trim());
  if (!match) return color;
  const value = styles.getPropertyValue(match[1]).trim();
  if (value) return value;
  return match[2] ? resolveCssColor(styles, match[2]) : color;
}

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(REDUCED_MOTION);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
}
