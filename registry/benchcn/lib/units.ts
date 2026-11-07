// benchcn.dev · units
// Engineering notation and the 1-2-5 stepping that instrument knobs use.
const PREFIXES: Record<number, string> = {
  [-12]: "p",
  [-9]: "n",
  [-6]: "µ",
  [-3]: "m",
  0: "",
  3: "k",
  6: "M",
  9: "G",
};

const MIN_EXPONENT = -12;
const MAX_EXPONENT = 9;

/** `formatSi(0.00025, "s")` is `"250 µs"`; `formatSi(1000, "Hz")` is `"1.00 kHz"`. */
export function formatSi(value: number, unit = "", digits = 3): string {
  if (!Number.isFinite(value)) return `— ${unit}`.trim();
  if (value === 0) return `0 ${unit}`.trim();

  let exponent = Math.floor(Math.log10(Math.abs(value)) / 3) * 3;
  exponent = Math.min(MAX_EXPONENT, Math.max(MIN_EXPONENT, exponent));
  let text = toSignificant(value / 10 ** exponent, digits);

  if (Math.abs(Number(text)) >= 1000 && exponent < MAX_EXPONENT) {
    exponent += 3;
    text = toSignificant(Number(text) / 1000, digits);
  }

  return `${text} ${PREFIXES[exponent]}${unit}`.trimEnd();
}

function toSignificant(value: number, digits: number): string {
  const magnitude = Math.floor(Math.log10(Math.abs(value)));
  const decimals = Math.max(0, digits - 1 - magnitude);
  return value.toFixed(decimals);
}

const SERIES = [1, 2, 5];

/** Next value up or down the 1-2-5 series: 200 µs becomes 500 µs or 100 µs. */
export function stepValue(value: number, direction: 1 | -1): number {
  if (!(value > 0)) return direction > 0 ? 1 : 0;
  const decade = Math.floor(Math.log10(value));
  const mantissa = value / 10 ** decade;
  let index = 0;
  let best = Number.POSITIVE_INFINITY;
  SERIES.forEach((step, i) => {
    const distance = Math.abs(Math.log(mantissa / step));
    if (distance < best) {
      best = distance;
      index = i;
    }
  });

  const next = index + direction;
  if (next < 0) return Number((SERIES[SERIES.length - 1] * 10 ** (decade - 1)).toPrecision(2));
  if (next >= SERIES.length) return Number((SERIES[0] * 10 ** (decade + 1)).toPrecision(2));
  return Number((SERIES[next] * 10 ** decade).toPrecision(2));
}
