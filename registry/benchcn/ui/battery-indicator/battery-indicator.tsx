// benchcn.dev · battery-indicator
// Charge as a battery glyph and a percentage, from a pack voltage or a percent. Grey while the
// charge is fine; amber and red only when it is low or critical, with the word written out.
import type { ComponentProps, ReactElement } from "react";

import { cn } from "@/lib/utils";
import {
  type BatteryCurve,
  batteryPercent,
  type BatteryState,
  batteryState,
  type BatteryThresholds,
  type BatteryUnit,
} from "@/registry/benchcn/lib/battery";

export type BatteryIndicatorProps = Omit<ComponentProps<"span">, "children"> & {
  /** A percentage, or volts with `unit="V"`. `null` shows `--`. */
  value: number | null | undefined;
  unit?: BatteryUnit;
  /** Empty and full, in the same unit as `value`. Pass both for volts. */
  min?: number;
  max?: number;
  /** Volts to percent as `[volts, percent]` points, for a pack whose discharge is not linear. */
  curve?: BatteryCurve;
  /** Percent at or below which the charge is low or critical. */
  thresholds?: BatteryThresholds;
  charging?: boolean;
  /** Accessible name. */
  label?: string;
  /** Show the percentage (and volts) next to the glyph. */
  showValue?: boolean;
};

const STATE_TEXT: Record<BatteryState, string | null> = {
  normal: null,
  low: "Low",
  critical: "Critical",
  unknown: null,
};

const STATE_TONE: Record<BatteryState, string> = {
  normal: "text-muted-foreground",
  low: "text-warning",
  critical: "text-destructive",
  unknown: "text-muted-foreground",
};

export function BatteryIndicator({
  value,
  unit = "%",
  min,
  max,
  curve,
  thresholds,
  charging = false,
  label = "Battery",
  showValue = true,
  className,
  ...props
}: BatteryIndicatorProps): ReactElement {
  const percent = batteryPercent(value, { unit, min, max, curve });
  const state = batteryState(percent, thresholds);
  const rounded = percent === null ? null : Math.round(percent);
  const volts = unit === "V" && percent !== null ? `${(value as number).toFixed(2)} V` : null;
  const valueText =
    rounded === null
      ? "No reading"
      : [
          `${rounded} percent`,
          volts,
          charging ? "charging" : null,
          STATE_TEXT[state]?.toLowerCase(),
        ]
          .filter(Boolean)
          .join(", ");

  return (
    <span
      data-slot="battery-indicator"
      data-state={state}
      data-charging={charging}
      className={cn("inline-flex items-center gap-2 align-middle text-sm", className)}
      {...props}
    >
      <meter
        className="sr-only"
        aria-label={label}
        aria-valuetext={valueText}
        min={0}
        max={100}
        value={rounded ?? undefined}
      />
      <svg
        aria-hidden
        viewBox="0 0 27 14"
        className={cn("h-[1em] w-auto shrink-0", STATE_TONE[state])}
      >
        <rect
          x="0.75"
          y="0.75"
          width="22.5"
          height="12.5"
          rx="3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          opacity={state === "critical" ? 1 : 0.6}
        />
        <rect
          x="24.25"
          y="4.5"
          width="2"
          height="5"
          rx="1"
          fill="currentColor"
          opacity={state === "critical" ? 1 : 0.6}
        />
        {percent !== null ? (
          <rect
            x="2.5"
            y="2.5"
            width="19"
            height="9"
            rx="1.25"
            fill="currentColor"
            className="motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out"
            style={{
              transform: `scaleX(${percent / 100})`,
              transformBox: "fill-box",
              transformOrigin: "left",
            }}
          />
        ) : null}
        {charging ? (
          <path
            d="M13.6 1.6 9.2 7.6h3l-1.3 4.8 4.5-6.2h-3z"
            className="fill-foreground stroke-background"
            strokeWidth="1.25"
            strokeLinejoin="round"
            paintOrder="stroke"
          />
        ) : null}
      </svg>
      {showValue ? (
        <span aria-hidden className="flex items-baseline gap-1.5 tabular-nums">
          <span>{rounded === null ? "--" : `${rounded}%`}</span>
          {volts ? <span className="text-muted-foreground text-xs">{volts}</span> : null}
          {STATE_TEXT[state] ? (
            <span className={cn("text-xs", STATE_TONE[state])}>{STATE_TEXT[state]}</span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
