// benchcn.dev · range-bar
// The analog indicator high-performance HMIs use instead of a dial: grey while normal, colour
// only when a limit is crossed, a setpoint triangle that tells confirmed from commanded, and the
// recent spread as a band, so a glance says where the value sits, not just what it is.
import { type ComponentProps, type ReactElement, type ReactNode, useId } from "react";

import { cn } from "@/lib/utils";
import { INSTRUMENT_FRAME, InstrumentLabel } from "@/registry/benchcn/lib/instrument";

export type RangeThresholds = {
  /** Below `low` or above `high` is an alarm; below `warnBelow` or above `warnAbove` a warning. */
  low?: number;
  high?: number;
  warnBelow?: number;
  warnAbove?: number;
};

export type RangeState = "low-alarm" | "low" | "normal" | "high" | "high-alarm" | "unknown";

export type RangeBarProps = ComponentProps<"div"> & {
  label: ReactNode;
  value: number | null | undefined;
  unit?: string;
  /** Ends of the scale. Values beyond them pin to the end with an arrow. */
  min: number;
  max: number;
  /** Decimal places. Defaults to a sensible count for the magnitude. */
  precision?: number;
  thresholds?: RangeThresholds;
  /** The setpoint the device confirmed, drawn as a solid triangle. */
  setpoint?: number | null;
  /** A setpoint sent but not yet confirmed, drawn hollow while it differs from `setpoint`. */
  commanded?: number | null;
  /** Recent values; their spread is drawn as a thin line beside the track. */
  recent?: ArrayLike<number>;
  orientation?: "horizontal" | "vertical";
};

export function rangeState(
  value: number | null | undefined,
  thresholds: RangeThresholds = {},
): RangeState {
  if (value === null || value === undefined || !Number.isFinite(value)) return "unknown";
  if (thresholds.low !== undefined && value < thresholds.low) return "low-alarm";
  if (thresholds.high !== undefined && value > thresholds.high) return "high-alarm";
  if (thresholds.warnBelow !== undefined && value < thresholds.warnBelow) return "low";
  if (thresholds.warnAbove !== undefined && value > thresholds.warnAbove) return "high";
  return "normal";
}

/** Position on the scale from 0 to 1, clamped, and whether the value is off either end. */
export function scalePosition(
  value: number,
  min: number,
  max: number,
): { at: number; off: "below" | "above" | null } {
  const raw = max === min ? 0.5 : (value - min) / (max - min);
  if (raw < 0) return { at: 0, off: "below" };
  if (raw > 1) return { at: 1, off: "above" };
  return { at: raw, off: null };
}

/** The normal band: from the lower warning (or alarm) limit to the upper one, as fractions. */
export function normalBand(
  min: number,
  max: number,
  thresholds: RangeThresholds = {},
): { from: number; to: number } | null {
  const lower = thresholds.warnBelow ?? thresholds.low;
  const upper = thresholds.warnAbove ?? thresholds.high;
  if (lower === undefined && upper === undefined) return null;
  return {
    from: scalePosition(lower ?? min, min, max).at,
    to: scalePosition(upper ?? max, min, max).at,
  };
}

/** The spread of recent values as fractions, or null when there is nothing to show. */
export function recentSpread(
  recent: ArrayLike<number> | undefined,
  min: number,
  max: number,
): { from: number; to: number } | null {
  if (!recent || recent.length < 2) return null;
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < recent.length; i += 1) {
    const v = recent[i];
    if (!Number.isFinite(v)) continue;
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  if (!Number.isFinite(lo)) return null;
  return { from: scalePosition(lo, min, max).at, to: scalePosition(hi, min, max).at };
}

const STATE_TEXT: Record<RangeState, string> = {
  "low-alarm": "Low alarm",
  low: "Low",
  normal: "Normal",
  high: "High",
  "high-alarm": "High alarm",
  unknown: "No data",
};

const STATE_TONE: Record<RangeState, string> = {
  "low-alarm": "text-destructive",
  low: "text-warning",
  normal: "text-muted-foreground",
  high: "text-warning",
  "high-alarm": "text-destructive",
  unknown: "text-muted-foreground",
};

const MARKER_TONE: Record<RangeState, string> = {
  "low-alarm": "bg-destructive",
  low: "bg-warning",
  normal: "bg-foreground",
  high: "bg-warning",
  "high-alarm": "bg-destructive",
  unknown: "bg-transparent",
};

function formatValue(value: number, precision?: number): string {
  if (precision !== undefined) return value.toFixed(precision);
  const abs = Math.abs(value);
  return value.toFixed(abs >= 100 ? 0 : abs >= 10 ? 1 : 2);
}

function withUnit(text: string, unit?: string): string {
  return unit ? `${text} ${unit}` : text;
}

/** One position along the bar, in either orientation. */
function place(at: number, vertical: boolean): { left?: string; bottom?: string } {
  return vertical ? { bottom: `${at * 100}%` } : { left: `${at * 100}%` };
}

function span(from: number, to: number, vertical: boolean) {
  return vertical
    ? { bottom: `${from * 100}%`, height: `${(to - from) * 100}%` }
    : { left: `${from * 100}%`, width: `${(to - from) * 100}%` };
}

/** Points down by default; `turn` rotates it to point right, up or left. */
function Triangle({
  hollow = false,
  turn = "down",
  className,
}: {
  hollow?: boolean;
  turn?: "down" | "right" | "up" | "left";
  className?: string;
}): ReactElement {
  const rotate = { down: "", right: "-rotate-90", up: "rotate-180", left: "rotate-90" }[turn];
  return (
    <svg aria-hidden viewBox="0 0 10 8" className={cn("block size-2.5", rotate, className)}>
      <path
        d="M1 1h8L5 7z"
        fill={hollow ? "none" : "currentColor"}
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function RangeBar({
  label,
  value,
  unit,
  min,
  max,
  precision,
  thresholds,
  setpoint,
  commanded,
  recent,
  orientation = "horizontal",
  className,
  children,
  ...props
}: RangeBarProps): ReactElement {
  const id = useId();
  const vertical = orientation === "vertical";
  const state = rangeState(value, thresholds);
  const hasValue = state !== "unknown";
  const position = hasValue ? scalePosition(value as number, min, max) : null;
  const band = normalBand(min, max, thresholds);
  const spread = recentSpread(recent, min, max);
  const pendingSetpoint =
    commanded !== null && commanded !== undefined && commanded !== setpoint ? commanded : null;
  const limits = [thresholds?.low, thresholds?.high].filter(
    (v): v is number => v !== undefined && v >= min && v <= max,
  );
  const format = (n: number) => formatValue(n, precision);
  const valueText = hasValue
    ? [
        withUnit(format(value as number), unit),
        STATE_TEXT[state].toLowerCase(),
        setpoint !== null && setpoint !== undefined
          ? `setpoint ${withUnit(format(setpoint), unit)}`
          : null,
      ]
        .filter(Boolean)
        .join(", ")
    : "No data";

  const bar = (
    <div className={cn("relative", vertical ? "h-full w-10 self-stretch py-1" : "h-8 w-full px-1")}>
      <div className={cn("absolute", vertical ? "inset-x-0 inset-y-1" : "inset-x-1 inset-y-0")}>
        <div
          className={cn(
            "bg-muted absolute overflow-hidden rounded-full",
            vertical
              ? "inset-y-0 left-1/2 w-2 -translate-x-1/2"
              : "inset-x-0 top-1/2 h-2 -translate-y-1/2",
          )}
        >
          {band ? (
            <span
              aria-hidden
              className={cn(
                "absolute bg-[color-mix(in_oklab,var(--muted-foreground),transparent_75%)]",
                vertical ? "inset-x-0" : "inset-y-0",
              )}
              style={span(band.from, band.to, vertical)}
            />
          ) : null}
        </div>
        {/* Beside the track rather than on it, so the track keeps one meaning: the normal band. */}
        {spread ? (
          <span
            aria-hidden
            className={cn(
              "bg-muted-foreground/70 absolute rounded-full",
              vertical ? "left-[calc(50%+7px)] w-0.5" : "top-[calc(50%+7px)] h-0.5",
            )}
            style={span(spread.from, Math.max(spread.to, spread.from + 0.005), vertical)}
          />
        ) : null}

        {limits.map((limit) => (
          <span
            key={limit}
            aria-hidden
            className={cn(
              "bg-muted-foreground/60 absolute",
              vertical
                ? "left-1/2 h-px w-4 -translate-x-1/2 translate-y-1/2"
                : "top-1/2 h-4 w-px -translate-x-1/2 -translate-y-1/2",
            )}
            style={place(scalePosition(limit, min, max).at, vertical)}
          />
        ))}

        {setpoint !== null && setpoint !== undefined ? (
          <span
            aria-hidden
            className={cn(
              "absolute",
              vertical ? "left-0 translate-y-1/2" : "top-0 -translate-x-1/2",
            )}
            style={place(scalePosition(setpoint, min, max).at, vertical)}
          >
            <Triangle turn={vertical ? "right" : "down"} className="text-foreground" />
          </span>
        ) : null}
        {pendingSetpoint !== null ? (
          <span
            aria-hidden
            className={cn(
              "absolute opacity-70",
              vertical ? "left-0 translate-y-1/2" : "top-0 -translate-x-1/2",
            )}
            style={place(scalePosition(pendingSetpoint, min, max).at, vertical)}
          >
            <Triangle hollow turn={vertical ? "right" : "down"} className="text-foreground" />
          </span>
        ) : null}

        {position ? (
          <span
            aria-hidden
            className={cn(
              "absolute rounded-full motion-safe:transition-[left,bottom] motion-safe:duration-300 motion-safe:ease-out",
              MARKER_TONE[state],
              vertical
                ? "left-1/2 h-0.5 w-5 -translate-x-1/2 translate-y-1/2"
                : "top-1/2 h-5 w-0.5 -translate-x-1/2 -translate-y-1/2",
            )}
            style={place(position.at, vertical)}
          />
        ) : null}
        {position?.off ? (
          <span
            aria-hidden
            className={cn(
              "absolute",
              STATE_TONE[state],
              vertical
                ? position.off === "above"
                  ? "-top-3 left-1/2 -translate-x-1/2"
                  : "-bottom-3 left-1/2 -translate-x-1/2"
                : position.off === "above"
                  ? "top-1/2 -right-3 -translate-y-1/2"
                  : "top-1/2 -left-3 -translate-y-1/2",
            )}
          >
            <Triangle
              turn={
                vertical
                  ? position.off === "above"
                    ? "up"
                    : "down"
                  : position.off === "above"
                    ? "right"
                    : "left"
              }
            />
          </span>
        ) : null}
      </div>
    </div>
  );

  const readout = (
    <div className="flex items-baseline gap-1.5">
      <span
        className={cn(
          "text-2xl leading-none font-medium tracking-tight tabular-nums",
          state.endsWith("alarm") && "text-destructive",
        )}
      >
        {hasValue ? format(value as number) : "--"}
      </span>
      {unit ? <span className="text-muted-foreground text-sm">{unit}</span> : null}
    </div>
  );

  const header = (
    <div className="flex items-start justify-between gap-3">
      <span id={id} className="truncate text-sm font-medium">
        {label}
      </span>
      <span className={cn("shrink-0 text-xs", STATE_TONE[state])}>{STATE_TEXT[state]}</span>
    </div>
  );

  const setpointText =
    setpoint !== null && setpoint !== undefined ? (
      <InstrumentLabel className="tabular-nums">
        SP {withUnit(format(setpoint), unit)}
        {pendingSetpoint !== null ? `, sent ${format(pendingSetpoint)}` : ""}
      </InstrumentLabel>
    ) : null;

  return (
    <div
      data-slot="range-bar"
      data-state={state}
      data-orientation={orientation}
      className={cn(INSTRUMENT_FRAME, vertical && "w-fit", className)}
      {...props}
    >
      {header}
      <meter
        className="sr-only"
        aria-labelledby={id}
        aria-valuetext={valueText}
        min={min}
        max={max}
        value={hasValue ? (value as number) : undefined}
      />
      {vertical ? (
        <div className="flex h-44 gap-3">
          <div className="text-muted-foreground flex flex-col justify-between py-0.5 text-[11px] tabular-nums">
            <span>{max}</span>
            <span>{min}</span>
          </div>
          {bar}
          <div className="flex flex-col justify-end gap-1.5">
            {readout}
            {setpointText}
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-end justify-between gap-3">
            {readout}
            {setpointText}
          </div>
          <div className="flex flex-col gap-1">
            {bar}
            <div className="text-muted-foreground flex justify-between px-1 text-[11px] tabular-nums">
              <span>{min}</span>
              <span>{withUnit(String(max), unit)}</span>
            </div>
          </div>
        </>
      )}
      {children}
    </div>
  );
}
