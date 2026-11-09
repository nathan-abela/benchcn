// benchcn.dev · strip-chart
// Pure maths for a rolling trend: what is in view, the value range, tick steps, where the line must
// break because samples stopped, and CSV export of everything recorded.

/** One reading. `t` is milliseconds since the Unix epoch. */
export type StripPoint = { t: number; v: number };

export type StripRange = { min: number; max: number };

/** Index of the first point at or after `t`. Points are sorted by time. */
export function firstAtOrAfter(points: ArrayLike<StripPoint>, t: number): number {
  let lo = 0;
  let hi = points.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid].t < t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** The points drawn for a window ending at `end`, plus one either side so lines reach the edges. */
export function visibleSlice(
  points: ArrayLike<StripPoint>,
  start: number,
  end: number,
): StripPoint[] {
  const from = Math.max(0, firstAtOrAfter(points, start) - 1);
  const to = Math.min(points.length, firstAtOrAfter(points, end) + 1);
  return Array.prototype.slice.call(points, from, to) as StripPoint[];
}

/**
 * The value range to draw. Fixed bounds win; otherwise the data's extent padded by 8%, so a trace
 * never sits on the frame. A flat line gets a band around it instead of a zero-height range.
 */
export function valueRange(
  points: ArrayLike<StripPoint>[],
  fixed: Partial<StripRange> = {},
): StripRange | null {
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (const list of points) {
    for (let i = 0; i < list.length; i += 1) {
      const v = list[i].v;
      if (!Number.isFinite(v)) continue;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  if (fixed.min !== undefined) lo = fixed.min;
  if (fixed.max !== undefined) hi = fixed.max;
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null;
  if (hi === lo) {
    const band = Math.abs(lo) * 0.05 || 1;
    return {
      min: fixed.min ?? lo - band,
      max: fixed.max ?? hi + band,
    };
  }
  const pad = (hi - lo) * 0.08;
  return {
    min: fixed.min ?? lo - pad,
    max: fixed.max ?? hi + pad,
  };
}

/** A 1, 2 or 5 step that gives at most `count` ticks across `span`. */
export function tickStep(span: number, count: number): number {
  const raw = span / Math.max(1, count);
  const decade = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 5]) if (m * decade >= raw) return m * decade;
  return 10 * decade;
}

/** Tick values inside the range, on multiples of the step. */
export function ticks(range: StripRange, count: number): number[] {
  const step = tickStep(range.max - range.min, count);
  const out: number[] = [];
  for (let v = Math.ceil(range.min / step) * step; v <= range.max + step * 1e-9; v += step) {
    out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  }
  return out;
}

/**
 * Splits points into runs wherever two neighbours are further apart than `gap` milliseconds. A
 * dropout is drawn as a break, never as a line across time nobody measured.
 */
export function splitAtGaps(points: StripPoint[], gap: number): StripPoint[][] {
  const runs: StripPoint[][] = [];
  let run: StripPoint[] = [];
  for (const point of points) {
    if (run.length > 0 && point.t - run[run.length - 1].t > gap) {
      runs.push(run);
      run = [];
    }
    run.push(point);
  }
  if (run.length > 0) runs.push(run);
  return runs;
}

/** The point closest in time to `t`, or null when the nearest is further than `within` ms away. */
export function nearestPoint(
  points: ArrayLike<StripPoint>,
  t: number,
  within: number,
): StripPoint | null {
  if (points.length === 0) return null;
  const i = firstAtOrAfter(points, t);
  const candidates = [points[i - 1], points[i]].filter(Boolean);
  let best: StripPoint | null = null;
  for (const p of candidates) {
    if (!best || Math.abs(p.t - t) < Math.abs(best.t - t)) best = p;
  }
  return best && Math.abs(best.t - t) <= within ? best : null;
}

export type CsvSeries = { id: string; unit?: string; points: ArrayLike<StripPoint> };

const csvCell = (text: string): string =>
  /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;

/**
 * One row per distinct timestamp, ISO time first, one column per series. A series without a
 * sample at that instant leaves its cell empty rather than repeating an old value.
 */
export function toCsv(series: CsvSeries[]): string {
  const times = new Set<number>();
  const byTime = series.map((s) => {
    const map = new Map<number, number>();
    for (let i = 0; i < s.points.length; i += 1) {
      map.set(s.points[i].t, s.points[i].v);
      times.add(s.points[i].t);
    }
    return map;
  });
  const header = ["time", ...series.map((s) => (s.unit ? `${s.id} (${s.unit})` : s.id))];
  const rows = [...times]
    .sort((a, b) => a - b)
    .map((t) => [
      new Date(t).toISOString(),
      ...byTime.map((map) => (map.has(t) ? String(map.get(t)) : "")),
    ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}
