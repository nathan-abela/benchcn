// benchcn.dev · signal-strength
// Signal bars from an RSSI in dBm or a 0 to 100 quality, with the reading beside them. The bar
// thresholds are a prop; the dBm defaults are Android's Wi-Fi levels.
import type { ComponentProps, ReactElement } from "react";

import { cn } from "@/lib/utils";
import {
  defaultSignalThresholds,
  signalBars,
  type SignalUnit,
} from "@/registry/benchcn/lib/signal-bars";

export type SignalStrengthProps = Omit<ComponentProps<"span">, "children"> & {
  /** RSSI in dBm, or quality in percent with `unit="%"`. `null` shows `--`. */
  value: number | null | undefined;
  unit?: SignalUnit;
  bars?: number;
  /** The reading each bar needs, lowest bar first. Sets the number of bars. */
  thresholds?: readonly number[];
  /** Accessible name. */
  label?: string;
  /** Show the reading next to the bars. */
  showValue?: boolean;
};

const BAR_WIDTH = 3;
const BAR_GAP = 1.75;
const HEIGHT = 12;

export function SignalStrength({
  value,
  unit = "dBm",
  bars = 4,
  thresholds,
  label = "Signal strength",
  showValue = true,
  className,
  ...props
}: SignalStrengthProps): ReactElement {
  const steps = thresholds ?? defaultSignalThresholds(unit, bars);
  const count = steps.length;
  const lit = signalBars(value, steps);
  const hasValue = typeof value === "number" && Number.isFinite(value);
  const reading = hasValue
    ? unit === "%"
      ? `${Math.round(value)}%`
      : `${Math.round(value)} dBm`
    : "--";
  const width = count * BAR_WIDTH + (count - 1) * BAR_GAP;

  return (
    <span
      data-slot="signal-strength"
      data-bars={lit}
      className={cn("inline-flex items-center gap-2 align-middle text-sm", className)}
      {...props}
    >
      <meter
        className="sr-only"
        aria-label={label}
        aria-valuetext={hasValue ? `${lit} of ${count} bars, ${reading}` : "No reading"}
        min={0}
        max={count}
        value={hasValue ? lit : undefined}
      />
      <svg aria-hidden viewBox={`0 0 ${width} ${HEIGHT}`} className="h-[0.95em] w-auto shrink-0">
        {steps.map((_, i) => {
          const h = Math.max(3, (HEIGHT * (i + 1)) / count);
          return (
            <rect
              // Bars never reorder, and their position is their identity.
              // oxlint-disable-next-line react/no-array-index-key
              key={i}
              x={i * (BAR_WIDTH + BAR_GAP)}
              y={HEIGHT - h}
              width={BAR_WIDTH}
              height={h}
              rx="0.75"
              className={cn(
                "motion-safe:transition-[fill] motion-safe:duration-150",
                i < lit ? "fill-foreground" : "fill-foreground/15",
              )}
            />
          );
        })}
      </svg>
      {showValue ? (
        <span aria-hidden className={cn("tabular-nums", !hasValue && "text-muted-foreground")}>
          {reading}
        </span>
      ) : null}
    </span>
  );
}
