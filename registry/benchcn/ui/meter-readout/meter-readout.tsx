// benchcn.dev · meter-readout
// A bench multimeter face: a big segment display, Hold that freezes the reading while recording
// carries on, and min, max and average since the last reset, the way a DMM's MIN/MAX mode works.
import { type ComponentProps, type ReactElement, type ReactNode, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { INSTRUMENT_FRAME, InstrumentLabel } from "@/registry/benchcn/lib/instrument";
import {
  type SegmentColorPreset,
  SevenSegment,
} from "@/registry/benchcn/ui/seven-segment/seven-segment";

export type MeterStats = { min: number; max: number; sum: number; count: number };

export const EMPTY_STATS: MeterStats = {
  min: Number.POSITIVE_INFINITY,
  max: Number.NEGATIVE_INFINITY,
  sum: 0,
  count: 0,
};

export function addReading(stats: MeterStats, value: number): MeterStats {
  if (!Number.isFinite(value)) return stats;
  return {
    min: Math.min(stats.min, value),
    max: Math.max(stats.max, value),
    sum: stats.sum + value,
    count: stats.count + 1,
  };
}

export function meanOf(stats: MeterStats): number | null {
  return stats.count === 0 ? null : stats.sum / stats.count;
}

export type MeterReadoutProps = Omit<ComponentProps<"div">, "color"> & {
  label: ReactNode;
  /** Measurement mode shown beside the label, such as `DC V`. */
  mode?: string;
  value: number | null | undefined;
  unit?: string;
  /** Decimal places on the display. */
  precision?: number;
  /** Digit positions on the display. */
  digits?: number;
  /**
   * Changes with every new reading, such as the sample's timestamp, so repeated equal values still
   * count toward the average. Without it, only changes in `value` are recorded.
   */
  sampleKey?: unknown;
  /** A preset name or any CSS colour for the segments. */
  color?: SegmentColorPreset | (string & {});
};

export function MeterReadout({
  label,
  mode,
  value,
  unit,
  precision = 3,
  digits = 5,
  sampleKey,
  color,
  className,
  children,
  ...props
}: MeterReadoutProps): ReactElement {
  const [stats, setStats] = useState(EMPTY_STATS);
  const [held, setHeld] = useState<number | null>(null);
  const [seen, setSeen] = useState<unknown>(undefined);
  const hasValue = typeof value === "number" && Number.isFinite(value);

  // Record each new reading as it arrives, held or not, the way a meter keeps MIN/MAX running.
  const key = sampleKey === undefined ? value : sampleKey;
  if (hasValue && key !== seen) {
    setSeen(key);
    setStats(addReading(stats, value));
  }

  const holding = held !== null;
  const shown = holding ? held : hasValue ? value : null;
  // The unit is on the display, so the statistics stay narrow enough not to wrap.
  const format = (n: number | null) =>
    n === null || !Number.isFinite(n) ? "--" : n.toFixed(precision);
  const mean = meanOf(stats);

  return (
    <div
      data-slot="meter-readout"
      data-holding={holding}
      className={cn(INSTRUMENT_FRAME, "gap-4", className)}
      {...props}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-sm font-medium">{label}</span>
          {mode ? <InstrumentLabel className="shrink-0">{mode}</InstrumentLabel> : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant={holding ? "secondary" : "outline"}
            size="xs"
            aria-pressed={holding}
            disabled={!holding && !hasValue}
            onClick={() => setHeld(holding ? null : (value as number))}
          >
            Hold
          </Button>
          <Button
            variant="outline"
            size="xs"
            disabled={stats.count === 0}
            onClick={() => setStats(EMPTY_STATS)}
          >
            Reset
          </Button>
        </div>
      </div>

      <div className="flex items-end justify-end gap-2">
        <SevenSegment
          value={shown === null ? "-".repeat(Math.min(digits, 4)) : shown}
          decimals={shown === null ? undefined : precision}
          digits={digits}
          size={52}
          color={color}
          label={
            shown === null
              ? "No reading"
              : `${format(shown)}${unit ? ` ${unit}` : ""}${holding ? ", held" : ""}`
          }
        />
        <span className="text-muted-foreground w-6 pb-1 text-sm">{unit}</span>
      </div>

      <dl className="grid grid-cols-3 gap-x-4 text-sm font-medium tabular-nums">
        <div className="flex flex-col gap-1">
          <dt>
            <InstrumentLabel>Min</InstrumentLabel>
          </dt>
          <dd>{format(stats.count ? stats.min : null)}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt>
            <InstrumentLabel>Max</InstrumentLabel>
          </dt>
          <dd>{format(stats.count ? stats.max : null)}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt>
            <InstrumentLabel>Avg of {stats.count}</InstrumentLabel>
          </dt>
          <dd>{format(mean)}</dd>
        </div>
      </dl>
      {children}
    </div>
  );
}
