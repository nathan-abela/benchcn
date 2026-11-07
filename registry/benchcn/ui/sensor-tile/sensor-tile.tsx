// benchcn.dev · sensor-tile
// One slow reading, done properly: big tabular value, unit, a state derived from thresholds, a
// range bar and a sparkline. Goes stale on its own when samples stop arriving.
import { type ComponentProps, type ReactElement, type ReactNode, useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import { INSTRUMENT_FRAME, InstrumentLabel } from "@/registry/benchcn/lib/instrument";

export type SensorThresholds = {
  /** Range of the bar. Defaults to the thresholds or the data. */
  min?: number;
  max?: number;
  /** Below `low` or above `high` the reading is an alarm; inside `warnBelow`/`warnAbove` a warning. */
  low?: number;
  high?: number;
  warnBelow?: number;
  warnAbove?: number;
};

export type SensorState = "ok" | "warn" | "alarm" | "stale" | "unknown";

export type SensorTileProps = ComponentProps<"div"> & {
  label: ReactNode;
  value: number | null | undefined;
  unit?: string;
  /** Decimal places. Defaults to a sensible count for the magnitude. */
  precision?: number;
  thresholds?: SensorThresholds;
  /** Recent values for the sparkline, oldest first. */
  history?: ArrayLike<number>;
  /** Timestamp of the value in milliseconds; used for the stale check and the age. */
  updatedAt?: number;
  /** Milliseconds without an update before the tile reports stale. */
  staleAfter?: number;
  /** Override the derived state. */
  state?: SensorState;
};

export function sensorState(
  value: number | null | undefined,
  thresholds: SensorThresholds | undefined,
  age: number | null,
  staleAfter: number,
): SensorState {
  if (value === null || value === undefined || !Number.isFinite(value)) return "unknown";
  if (age !== null && age > staleAfter) return "stale";
  if (!thresholds) return "ok";
  if (thresholds.low !== undefined && value < thresholds.low) return "alarm";
  if (thresholds.high !== undefined && value > thresholds.high) return "alarm";
  if (thresholds.warnBelow !== undefined && value < thresholds.warnBelow) return "warn";
  if (thresholds.warnAbove !== undefined && value > thresholds.warnAbove) return "warn";
  return "ok";
}

export function formatReading(value: number, precision?: number): string {
  if (precision !== undefined) return value.toFixed(precision);
  const abs = Math.abs(value);
  if (abs >= 1000) return value.toFixed(0);
  if (abs >= 100) return value.toFixed(1);
  if (abs >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

const STATE_TEXT: Record<SensorState, string> = {
  ok: "OK",
  warn: "Warn",
  alarm: "Alarm",
  stale: "Stale",
  unknown: "No data",
};

const STATE_CLASS: Record<SensorState, string> = {
  ok: "text-success",
  warn: "text-warning",
  alarm: "text-destructive",
  stale: "text-muted-foreground",
  unknown: "text-muted-foreground",
};

const STATE_BAR: Record<SensorState, string> = {
  ok: "bg-success",
  warn: "bg-warning",
  alarm: "bg-destructive",
  stale: "bg-muted-foreground",
  unknown: "bg-muted-foreground",
};

function useNow(interval: number, enabled: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => setNow(Date.now()), interval);
    return () => window.clearInterval(timer);
  }, [interval, enabled]);
  return now;
}

function formatAge(ms: number): string {
  if (ms < 2000) return "now";
  if (ms < 60_000) return `${Math.round(ms / 1000)} s ago`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)} min ago`;
  return `${Math.round(ms / 3_600_000)} h ago`;
}

export function Sparkline({
  values,
  className,
  stroke = "currentColor",
}: {
  values: ArrayLike<number>;
  className?: string;
  stroke?: string;
}): ReactElement | null {
  const n = values.length;
  if (n < 2) return null;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < n; i += 1) {
    min = Math.min(min, values[i]);
    max = Math.max(max, values[i]);
  }
  const span = max - min || 1;
  const w = 100;
  const h = 32;
  const points = Array.from({ length: n }, (_, i) => {
    const x = (i / (n - 1)) * w;
    const y = h - 2 - ((values[i] - min) / span) * (h - 4);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden
      className={cn("h-8 w-24", className)}
    >
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function SensorTile({
  label,
  value,
  unit,
  precision,
  thresholds,
  history,
  updatedAt,
  staleAfter = 10_000,
  state: stateOverride,
  className,
  children,
  ...props
}: SensorTileProps): ReactElement {
  const now = useNow(1000, updatedAt !== undefined);
  const age = updatedAt === undefined ? null : Math.max(0, now - updatedAt);
  const state = stateOverride ?? sensorState(value, thresholds, age, staleAfter);
  const hasValue = value !== null && value !== undefined && Number.isFinite(value);

  const min = thresholds?.min ?? thresholds?.low ?? thresholds?.warnBelow;
  const max = thresholds?.max ?? thresholds?.high ?? thresholds?.warnAbove;
  const showBar = min !== undefined && max !== undefined && max > min;
  const fraction = (v: number) => Math.min(1, Math.max(0, (v - min!) / (max! - min!)));

  return (
    <div
      data-slot="sensor-tile"
      data-state={state}
      className={cn(INSTRUMENT_FRAME, "gap-2", className)}
      {...props}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="truncate text-sm font-medium">{label}</span>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 font-mono text-[11px] tracking-[0.08em] uppercase",
            STATE_CLASS[state],
          )}
        >
          <span aria-hidden className={cn("size-1.5 rounded-full", STATE_BAR[state])} />
          {STATE_TEXT[state]}
        </span>
      </div>

      <div className="flex items-end justify-between gap-4">
        <div className="flex items-baseline gap-1.5">
          <span
            className={cn(
              "font-mono text-3xl leading-none font-medium tracking-tight tabular-nums",
              state === "stale" && "text-muted-foreground",
            )}
          >
            {hasValue ? formatReading(value, precision) : "—"}
          </span>
          {unit ? <span className="text-muted-foreground text-sm">{unit}</span> : null}
        </div>
        {history && history.length > 1 ? (
          <Sparkline values={history} className="text-muted-foreground/70 shrink-0" />
        ) : null}
      </div>

      {showBar ? (
        <div className="relative mt-1 h-1 w-full overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--foreground),transparent_90%)]">
          {thresholds?.warnBelow !== undefined || thresholds?.warnAbove !== undefined ? (
            <span
              aria-hidden
              className="bg-success/40 absolute inset-y-0"
              style={{
                left: `${fraction(thresholds?.warnBelow ?? min!) * 100}%`,
                right: `${(1 - fraction(thresholds?.warnAbove ?? max!)) * 100}%`,
              }}
            />
          ) : null}
          {hasValue ? (
            <span
              aria-hidden
              className={cn(
                "absolute inset-y-0 w-0.5 -translate-x-1/2 rounded-full transition-[left] duration-300",
                STATE_BAR[state],
              )}
              style={{ left: `${fraction(value) * 100}%` }}
            />
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <InstrumentLabel>
          {showBar ? `${min} – ${max}${unit ? ` ${unit}` : ""}` : ""}
        </InstrumentLabel>
        {age !== null ? <InstrumentLabel>{formatAge(age)}</InstrumentLabel> : null}
      </div>
      {children}
    </div>
  );
}
