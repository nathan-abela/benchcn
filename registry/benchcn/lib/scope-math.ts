// benchcn.dev · oscilloscope
// The maths behind the oscilloscope: edge triggering with hysteresis, window capture and the
// automatic measurements. No DOM, so it is tested on its own.
export type TriggerEdge = "rising" | "falling";

export type CaptureOptions = {
  /** Samples shown on screen. */
  windowLength: number;
  /** Fraction of the window shown before the trigger point. */
  pretrigger?: number;
  level: number;
  edge?: TriggerEdge;
  /** The signal must leave the level by this much before it can trigger again. */
  hysteresis?: number;
  mode?: "auto" | "normal";
};

export type Capture = {
  /** Fractional sample index of the first sample on screen. */
  start: number;
  triggered: boolean;
};

/**
 * Finds the most recent crossing of `level` in the given direction whose index lies in
 * `[from, to]`, interpolated between samples. Returns -1 when there is none.
 */
export function findLastTrigger(
  values: ArrayLike<number>,
  level: number,
  edge: TriggerEdge,
  from: number,
  to: number,
  hysteresis = 0,
): number {
  const sign = edge === "rising" ? 1 : -1;
  const first = Math.max(1, Math.floor(from));
  const last = Math.min(values.length - 1, Math.ceil(to));
  let armed = false;
  let found = -1;

  for (let i = first; i <= last; i += 1) {
    const a = (values[i - 1] - level) * sign;
    const b = (values[i] - level) * sign;
    if (b < -hysteresis) {
      armed = true;
    } else if (armed && a < 0 && b >= 0) {
      found = i - 1 + a / (a - b);
      armed = false;
    }
  }

  return found;
}

/**
 * Chooses which samples to show. Triggered captures place the trigger point at the pretrigger
 * position; otherwise auto mode shows the newest samples and normal mode shows nothing (`null`).
 */
export function captureWindow(values: ArrayLike<number>, options: CaptureOptions): Capture | null {
  const {
    windowLength,
    pretrigger = 0.5,
    level,
    edge = "rising",
    hysteresis = 0,
    mode = "auto",
  } = options;
  const length = values.length;
  const pre = Math.floor(windowLength * pretrigger);
  const post = windowLength - pre;

  if (length < windowLength) return { start: 0, triggered: false };

  const trigger = findLastTrigger(values, level, edge, pre, length - post, hysteresis);
  if (trigger >= 0) return { start: trigger - pre, triggered: true };
  if (mode === "normal") return null;
  return { start: length - windowLength, triggered: false };
}

export type Measurements = {
  min: number;
  max: number;
  peakToPeak: number;
  mean: number;
  rms: number;
  frequency: number | null;
  period: number | null;
  dutyCycle: number | null;
};

const EMPTY: Measurements = {
  min: 0,
  max: 0,
  peakToPeak: 0,
  mean: 0,
  rms: 0,
  frequency: null,
  period: null,
  dutyCycle: null,
};

/** Standard automatic measurements over `values[start, end)`. */
export function measure(
  values: ArrayLike<number>,
  sampleRate: number,
  start = 0,
  end = values.length,
): Measurements {
  const from = Math.max(0, Math.floor(start));
  const to = Math.min(values.length, Math.floor(end));
  const count = to - from;
  if (count <= 0 || !(sampleRate > 0)) return EMPTY;

  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let sum = 0;
  let sumOfSquares = 0;
  for (let i = from; i < to; i += 1) {
    const v = values[i];
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
    sumOfSquares += v * v;
  }

  const base: Measurements = {
    ...EMPTY,
    min,
    max,
    peakToPeak: max - min,
    mean: sum / count,
    rms: Math.sqrt(sumOfSquares / count),
  };

  const amplitude = max - min;
  if (amplitude < 1e-9) return base;

  const level = (min + max) / 2;
  const hysteresis = amplitude * 0.1;
  const crossings = findCrossings(values, level, hysteresis, from, to);
  if (crossings.length < 2) return base;

  const first = crossings[0];
  const last = crossings[crossings.length - 1];
  const halfCycles = crossings.length - 1;
  const frequency = (sampleRate * halfCycles) / (2 * (last.at - first.at));

  let high = 0;
  let span = 0;
  for (let i = 0; i + 1 < crossings.length; i += 1) {
    const length = crossings[i + 1].at - crossings[i].at;
    span += length;
    if (crossings[i].rising) high += length;
  }

  return {
    ...base,
    frequency,
    period: 1 / frequency,
    dutyCycle: span > 0 ? high / span : null,
  };
}

type Crossing = { at: number; rising: boolean };

function findCrossings(
  values: ArrayLike<number>,
  level: number,
  hysteresis: number,
  from: number,
  to: number,
): Crossing[] {
  const crossings: Crossing[] = [];
  let high = values[from] >= level;

  for (let i = from; i < to; i += 1) {
    const v = values[i];
    if (!high && v >= level + hysteresis) {
      crossings.push({ at: interpolate(values, i, level), rising: true });
      high = true;
    } else if (high && v <= level - hysteresis) {
      crossings.push({ at: interpolate(values, i, level), rising: false });
      high = false;
    }
  }

  return crossings;
}

function interpolate(values: ArrayLike<number>, i: number, level: number): number {
  for (let j = i; j > 0; j -= 1) {
    const a = values[j - 1];
    const b = values[j];
    if ((a - level) * (b - level) <= 0 && a !== b) return j - 1 + (level - a) / (b - a);
  }
  return i;
}

export type CursorAxis = "time" | "voltage";

export type CursorPair = [a: number, b: number];

export type CursorReadout = { a: number; b: number; delta: number };

/**
 * Cursors live in divisions from the centre line, so they keep their place on screen when the
 * scale changes. `origin` is where zero sits, also in divisions from the centre: the trigger
 * point for time, the channel offset for voltage.
 */
export function readCursors(positions: CursorPair, perDivision: number, origin = 0): CursorReadout {
  const a = (positions[0] - origin) * perDivision;
  const b = (positions[1] - origin) * perDivision;
  return { a, b, delta: b - a };
}

/** Moves one cursor, keeping it on a screen `divisions` wide or tall. */
export function moveCursor(
  positions: CursorPair,
  index: 0 | 1,
  position: number,
  divisions: number,
): CursorPair {
  const next: CursorPair = [positions[0], positions[1]];
  next[index] = Math.min(divisions / 2, Math.max(-divisions / 2, position));
  return next;
}
