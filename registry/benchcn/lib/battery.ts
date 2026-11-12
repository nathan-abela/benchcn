// benchcn.dev · battery-indicator
// Charge in percent from a percentage or a pack voltage, and whether it is low enough to say so.

export type BatteryUnit = "%" | "V";

/** Percent at or below which the charge is low or critical. */
export type BatteryThresholds = {
  low?: number;
  critical?: number;
};

export type BatteryState = "normal" | "low" | "critical" | "unknown";

/** Points of a discharge curve as `[volts, percent]`, in any order. */
export type BatteryCurve = ReadonlyArray<readonly [volts: number, percent: number]>;

export type BatteryScale = {
  unit?: BatteryUnit;
  /** Empty and full: percent for `%`, volts for `V`. */
  min?: number;
  max?: number;
  /** Maps volts to percent piecewise; replaces the straight line from `min` to `max`. */
  curve?: BatteryCurve;
};

export const DEFAULT_BATTERY_THRESHOLDS: Required<BatteryThresholds> = { low: 20, critical: 10 };

function clampPercent(percent: number): number {
  return Math.min(100, Math.max(0, percent));
}

function onCurve(volts: number, curve: BatteryCurve): number {
  const points = [...curve].sort((a, b) => a[0] - b[0]);
  if (volts <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i += 1) {
    const [v1, p1] = points[i];
    if (volts <= v1) {
      const [v0, p0] = points[i - 1];
      return v1 === v0 ? p1 : p0 + ((volts - v0) / (v1 - v0)) * (p1 - p0);
    }
  }
  return points[points.length - 1][1];
}

/** Charge from 0 to 100, or `null` without a reading. */
export function batteryPercent(
  value: number | null | undefined,
  { unit = "%", min, max, curve }: BatteryScale = {},
): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (unit === "V" && curve && curve.length > 0) return clampPercent(onCurve(value, curve));
  const lo = min ?? 0;
  const hi = max ?? 100;
  if (hi <= lo) return null;
  return clampPercent(((value - lo) / (hi - lo)) * 100);
}

export function batteryState(
  percent: number | null,
  thresholds: BatteryThresholds = {},
): BatteryState {
  if (percent === null) return "unknown";
  const { low, critical } = { ...DEFAULT_BATTERY_THRESHOLDS, ...thresholds };
  if (percent <= critical) return "critical";
  if (percent <= low) return "low";
  return "normal";
}
