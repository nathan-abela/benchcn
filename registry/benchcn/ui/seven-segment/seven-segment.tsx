// benchcn.dev · seven-segment
// Seven-segment display drawn as SVG segments, with unlit segments faintly visible the way a
// real module shows them. Digits, a few letters, minus, decimal points and colons.
import type { ComponentProps, CSSProperties, ReactElement } from "react";

import { cn } from "@/lib/utils";

export type SegmentColorPreset = "red" | "amber" | "green" | "blue" | "white";

export const SEGMENT_COLORS: Record<SegmentColorPreset, string> = {
  red: "oklch(0.68 0.24 28)",
  amber: "oklch(0.84 0.17 80)",
  green: "oklch(0.82 0.21 145)",
  blue: "oklch(0.74 0.17 240)",
  white: "oklch(0.97 0.01 90)",
};

export type SevenSegmentProps = Omit<ComponentProps<"div">, "color"> & {
  /** A number, or a string of digits, letters, `-`, `.`, `:` and spaces. */
  value: number | string;
  /** Total digit positions. Shorter values are right aligned with blanks. */
  digits?: number;
  /** Fixed number of decimals for numeric values. */
  decimals?: number;
  /** Pad numbers with leading zeros instead of blanks. */
  leadingZeros?: boolean;
  /** A preset name or any CSS colour. Defaults to the theme's primary colour. */
  color?: SegmentColorPreset | (string & {});
  /** Height of a digit in pixels. */
  size?: number;
  /** Opacity of unlit segments. */
  offOpacity?: number;
  /** Dark display window behind the digits. */
  bezel?: boolean;
  /** Accessible description. Defaults to the value. */
  label?: string;
};

// Segment bits: a=top, b=top right, c=bottom right, d=bottom, e=bottom left, f=top left, g=middle.
const A = 1;
const B = 2;
const C = 4;
const D = 8;
const E = 16;
const F = 32;
const G = 64;

export const SEGMENT_GLYPHS: Record<string, number> = {
  "0": A | B | C | D | E | F,
  "1": B | C,
  "2": A | B | D | E | G,
  "3": A | B | C | D | G,
  "4": B | C | F | G,
  "5": A | C | D | F | G,
  "6": A | C | D | E | F | G,
  "7": A | B | C,
  "8": A | B | C | D | E | F | G,
  "9": A | B | C | D | F | G,
  "-": G,
  _: D,
  " ": 0,
  A: A | B | C | E | F | G,
  b: C | D | E | F | G,
  C: A | D | E | F,
  c: D | E | G,
  d: B | C | D | E | G,
  E: A | D | E | F | G,
  F: A | E | F | G,
  H: B | C | E | F | G,
  h: C | E | F | G,
  L: D | E | F,
  n: C | E | G,
  o: C | D | E | G,
  P: A | B | E | F | G,
  r: E | G,
  t: D | E | F | G,
  u: C | D | E,
  y: B | C | D | F | G,
  "°": A | B | F | G,
};

const DIGIT_W = 56;
const DIGIT_H = 100;
const THICK = 11;
const GAP = 1.5;

type Segment = { points: string };

function horizontal(y: number): Segment {
  const x0 = THICK / 2 + GAP;
  const x1 = DIGIT_W - THICK / 2 - GAP;
  const h = THICK / 2;
  return {
    points: `${x0},${y} ${x0 + h},${y - h} ${x1 - h},${y - h} ${x1},${y} ${x1 - h},${y + h} ${x0 + h},${y + h}`,
  };
}

function vertical(x: number, y0: number, y1: number): Segment {
  const h = THICK / 2;
  const top = y0 + GAP + h;
  const bottom = y1 - GAP - h;
  return {
    points: `${x},${top - h} ${x + h},${top} ${x + h},${bottom} ${x},${bottom + h} ${x - h},${bottom} ${x - h},${top}`,
  };
}

const MID = DIGIT_H / 2;
const SEGMENTS: Segment[] = [
  horizontal(THICK / 2),
  vertical(DIGIT_W - THICK / 2, THICK / 2, MID),
  vertical(DIGIT_W - THICK / 2, MID, DIGIT_H - THICK / 2),
  horizontal(DIGIT_H - THICK / 2),
  vertical(THICK / 2, MID, DIGIT_H - THICK / 2),
  vertical(THICK / 2, THICK / 2, MID),
  horizontal(MID),
];

type Cell = { glyph: number; dot: boolean } | { colon: true };

export function toCells(
  value: number | string,
  {
    digits,
    decimals,
    leadingZeros,
  }: Pick<SevenSegmentProps, "digits" | "decimals" | "leadingZeros">,
): Cell[] {
  let text: string;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) text = "----";
    else text = decimals === undefined ? String(value) : value.toFixed(decimals);
  } else {
    text = value;
  }

  const cells: Cell[] = [];
  for (const char of text) {
    if (char === ".") {
      const last = cells[cells.length - 1];
      if (last && "glyph" in last && !last.dot) last.dot = true;
      else cells.push({ glyph: 0, dot: true });
    } else if (char === ":") {
      cells.push({ colon: true });
    } else {
      cells.push({
        glyph: SEGMENT_GLYPHS[char] ?? SEGMENT_GLYPHS[char.toUpperCase()] ?? 0,
        dot: false,
      });
    }
  }

  if (digits !== undefined) {
    const count = cells.filter((c) => "glyph" in c).length;
    const pad = Math.max(0, digits - count);
    const filler: Cell = leadingZeros
      ? { glyph: SEGMENT_GLYPHS["0"], dot: false }
      : { glyph: 0, dot: false };
    const padding: Cell[] = Array.from({ length: pad }, () => ({ ...filler }));
    if (leadingZeros && cells[0] && "glyph" in cells[0] && cells[0].glyph === SEGMENT_GLYPHS["-"]) {
      cells.splice(1, 0, ...padding);
    } else {
      cells.unshift(...padding);
    }
  }
  return cells;
}

export function segmentColor(color: SevenSegmentProps["color"]): string {
  if (!color) return "var(--primary)";
  return color in SEGMENT_COLORS ? SEGMENT_COLORS[color as SegmentColorPreset] : color;
}

export function SevenSegment({
  value,
  digits,
  decimals,
  leadingZeros,
  color,
  size = 40,
  offOpacity = 0.09,
  bezel = true,
  label,
  className,
  style,
  ...props
}: SevenSegmentProps): ReactElement {
  const cells = toCells(value, { digits, decimals, leadingZeros });
  const scale = size / DIGIT_H;
  const dotW = THICK * 1.6;
  const colonW = THICK * 1.4;
  const widths = cells.map((c) => ("colon" in c ? colonW : DIGIT_W + (c.dot ? dotW : 0)));
  const offsets = widths.reduce<number[]>((acc, w, i) => {
    acc.push(i === 0 ? 0 : acc[i - 1] + widths[i - 1] + 6);
    return acc;
  }, []);
  const totalW = widths.reduce((a, b) => a + b, 0) + Math.max(0, cells.length - 1) * 6;
  const text =
    typeof value === "number" && decimals !== undefined ? value.toFixed(decimals) : String(value);

  return (
    <div
      data-slot="seven-segment"
      className={cn(
        "inline-flex max-w-full items-center",
        bezel &&
          "rounded-md bg-[oklch(0.13_0.004_80)] px-2.5 py-1.5 shadow-[inset_0_1px_3px_rgb(0_0_0/0.6)]",
        className,
      )}
      style={{ "--segment": segmentColor(color), ...style } as CSSProperties}
      {...props}
    >
      <svg
        width={totalW * scale}
        height={DIGIT_H * scale}
        viewBox={`0 0 ${totalW} ${DIGIT_H}`}
        aria-hidden
        className="block h-auto max-w-full overflow-visible"
        style={{
          filter: "drop-shadow(0 0 1.5px color-mix(in oklab, var(--segment), transparent 40%))",
        }}
      >
        {cells.map((cell, i) => {
          const x0 = offsets[i];
          if ("colon" in cell) {
            return (
              <g key={x0} transform={`translate(${x0} 0) skewX(-6)`} fill="var(--segment)">
                <rect
                  x={colonW / 2 - THICK / 2}
                  y={MID - 22 - THICK / 2}
                  width={THICK}
                  height={THICK}
                  rx={1}
                />
                <rect
                  x={colonW / 2 - THICK / 2}
                  y={MID + 22 - THICK / 2}
                  width={THICK}
                  height={THICK}
                  rx={1}
                />
              </g>
            );
          }
          return (
            <g key={x0} transform={`translate(${x0} 0) skewX(-6)`} fill="var(--segment)">
              {SEGMENTS.map((segment, bit) => (
                <polygon
                  key={segment.points}
                  points={segment.points}
                  opacity={cell.glyph & (1 << bit) ? 1 : offOpacity}
                />
              ))}
              {cell.dot ? (
                <rect
                  x={DIGIT_W + 3}
                  y={DIGIT_H - THICK}
                  width={THICK}
                  height={THICK}
                  rx={1}
                  opacity={1}
                />
              ) : null}
            </g>
          );
        })}
      </svg>
      <span className="sr-only">{label ?? text}</span>
    </div>
  );
}
