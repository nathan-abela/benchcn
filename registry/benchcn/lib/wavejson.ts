// benchcn.dev · timing-diagram
// A small WaveJSON reader: one character per cycle, `.` repeats, data buses take labels from
// `data`. Enough for the timing figures in a datasheet-style page.
export type WaveKind = "low" | "high" | "x" | "z" | "data" | "clock-pos" | "clock-neg" | "gap";

export type WaveSegment = {
  kind: WaveKind;
  /** Cycle index. */
  start: number;
  end: number;
  label?: string;
  /** Colour slot for data segments, 1-based. */
  color?: number;
};

export type WaveSignal = {
  name: string;
  wave: string;
  data?: string[];
  /** Cycles per character. */
  period?: number;
  /** Shift in cycles. */
  phase?: number;
};

const KIND_OF: Record<string, WaveKind> = {
  "0": "low",
  l: "low",
  d: "low",
  "1": "high",
  h: "high",
  u: "high",
  x: "x",
  z: "z",
  p: "clock-pos",
  P: "clock-pos",
  n: "clock-neg",
  N: "clock-neg",
  "|": "gap",
};

export function parseWave(wave: string, data: string[] = [], period = 1): WaveSegment[] {
  const segments: WaveSegment[] = [];
  let dataIndex = 0;
  let cycle = 0;

  for (const char of wave) {
    if (char === ".") {
      const last = segments[segments.length - 1];
      if (last) last.end += period;
      cycle += period;
      continue;
    }
    if (char === "|") {
      segments.push({ kind: "gap", start: cycle, end: cycle });
      continue;
    }
    const kind = KIND_OF[char] ?? (/[2-9=]/.test(char) ? "data" : undefined);
    if (!kind) {
      cycle += period;
      continue;
    }
    const segment: WaveSegment = { kind, start: cycle, end: cycle + period };
    if (kind === "data") {
      segment.label = data[dataIndex];
      dataIndex += 1;
      segment.color = char === "=" ? 1 : Number(char) - 1;
    }
    segments.push(segment);
    cycle += period;
  }
  return segments;
}

/** Total cycles of the longest signal. */
export function waveLength(signals: WaveSignal[]): number {
  return signals.reduce((max, signal) => {
    const segments = parseWave(signal.wave, signal.data, signal.period ?? 1);
    const last = segments[segments.length - 1];
    return Math.max(max, (last?.end ?? 0) + (signal.phase ?? 0));
  }, 0);
}
