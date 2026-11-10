// benchcn.dev · led-bar
// Which segments of a bar graph display are lit, and which colour each one is. No DOM.

export type LedBarMode = "bar" | "dot";

export type LedBarThresholds = {
  /** Below `low` or above `high` is an alarm; below `warnBelow` or above `warnAbove` a warning. */
  low?: number;
  high?: number;
  warnBelow?: number;
  warnAbove?: number;
};

export type SegmentTone = "normal" | "warn" | "alarm";

/**
 * How many segments a value reaches, as a ladder of comparators does: segment `n` (1-based)
 * comes on once the value is `n / segments` of the way from `min` to `max`.
 */
export function segmentsReached(
  value: number | null | undefined,
  min: number,
  max: number,
  segments: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value) || max <= min) return 0;
  const fraction = (value - min) / (max - min);
  // The epsilon keeps 0.3 * 10 from landing on 2.999.
  return Math.min(segments, Math.max(0, Math.floor(fraction * segments + 1e-9)));
}

/** Bar mode lights every segment up to the value; dot mode only the one it reaches. */
export function isSegmentLit(index: number, reached: number, mode: LedBarMode): boolean {
  return mode === "bar" ? index < reached : index === reached - 1;
}

/**
 * The colour a segment is built with. It depends on the part of the range the segment covers,
 * not on the current value, the way a real bar has its red LEDs soldered at the top.
 */
export function segmentTone(
  index: number,
  min: number,
  max: number,
  segments: number,
  thresholds: LedBarThresholds = {},
): SegmentTone {
  const span = (max - min) / segments;
  const bottom = min + index * span;
  const top = bottom + span;
  const { low, high, warnBelow, warnAbove } = thresholds;
  // Half a millionth of a segment absorbs the rounding in `bottom` and `top`.
  const slack = span * 1e-6;
  if ((high !== undefined && top > high + slack) || (low !== undefined && bottom < low - slack)) {
    return "alarm";
  }
  if (
    (warnAbove !== undefined && top > warnAbove + slack) ||
    (warnBelow !== undefined && bottom < warnBelow - slack)
  ) {
    return "warn";
  }
  return "normal";
}
