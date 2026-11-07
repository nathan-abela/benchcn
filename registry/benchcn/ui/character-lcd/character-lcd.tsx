// benchcn.dev · character-lcd
// An HD44780-style character LCD rendered pixel for pixel from the A00 character ROM, with the
// classic module colours, backlight, cursor and up to eight custom glyphs.
import type { ComponentProps, CSSProperties, ReactElement } from "react";

import { cn } from "@/lib/utils";
import {
  GLYPH_HEIGHT,
  GLYPH_WIDTH,
  glyphFor,
  HD44780_A00,
  HD44780_CODE_FOR_CHAR,
} from "@/registry/benchcn/lib/hd44780-rom";

export type LcdColorPreset = "green" | "blue" | "amber" | "white" | "red";

type LcdPalette = { glass: string; pixel: string; off: string; frame: string };

/** Glass and pixel colours of common modules. `off` is the ghost of an unlit pixel. */
export const LCD_COLORS: Record<LcdColorPreset, LcdPalette> = {
  green: {
    glass: "oklch(0.84 0.14 118)",
    pixel: "oklch(0.22 0.03 120)",
    off: "oklch(0.78 0.12 118)",
    frame: "oklch(0.2 0.01 120)",
  },
  blue: {
    glass: "oklch(0.36 0.17 262)",
    pixel: "oklch(0.97 0.02 240)",
    off: "oklch(0.4 0.16 262)",
    frame: "oklch(0.18 0.03 262)",
  },
  amber: {
    glass: "oklch(0.2 0.02 60)",
    pixel: "oklch(0.86 0.17 75)",
    off: "oklch(0.26 0.03 65)",
    frame: "oklch(0.14 0.01 60)",
  },
  white: {
    glass: "oklch(0.2 0.005 260)",
    pixel: "oklch(0.98 0 0)",
    off: "oklch(0.27 0.005 260)",
    frame: "oklch(0.14 0 0)",
  },
  red: {
    glass: "oklch(0.2 0.02 20)",
    pixel: "oklch(0.7 0.23 25)",
    off: "oklch(0.26 0.04 20)",
    frame: "oklch(0.14 0.01 20)",
  },
};

export type CharacterLcdProps = Omit<ComponentProps<"div">, "color"> & {
  /** Text per row. Longer rows are clipped, shorter ones padded. */
  lines: string[];
  cols?: number;
  rows?: number;
  color?: LcdColorPreset;
  backlight?: boolean;
  /** Pixel size in CSS pixels. */
  scale?: number;
  cursor?: { col: number; row: number; blink?: boolean };
  /** Custom 5x8 glyphs keyed by the character that triggers them, like CGRAM. */
  customGlyphs?: Record<string, number[]>;
  label?: string;
};

const EXTRA_CODES: Record<string, number> = { "°": 0xdf };

const PIXEL = 1;
const GAP = 0.16;
const CHAR_W = GLYPH_WIDTH + 1;
const CHAR_H = GLYPH_HEIGHT + 1;
const PAD = 1.6;

function glyph(char: string, custom?: Record<string, number[]>): number[] {
  if (custom && char in custom) return custom[char];
  const code = HD44780_CODE_FOR_CHAR[char] ?? EXTRA_CODES[char];
  if (code !== undefined && code in HD44780_A00) return HD44780_A00[code];
  return glyphFor(char);
}

export function CharacterLcd({
  lines,
  cols = 16,
  rows = 2,
  color = "green",
  backlight = true,
  scale = 3,
  cursor,
  customGlyphs,
  label,
  className,
  style,
  ...props
}: CharacterLcdProps): ReactElement {
  const palette = LCD_COLORS[color];
  const width = cols * CHAR_W - 1 + PAD * 2;
  const height = rows * CHAR_H - 1 + PAD * 2;
  const text = Array.from({ length: rows }, (_, r) => (lines[r] ?? "").padEnd(cols).slice(0, cols));

  const lit: { x: number; y: number }[] = [];
  text.forEach((row, r) => {
    Array.from(row).forEach((char, c) => {
      const bitmap = glyph(char, customGlyphs);
      const cursorHere = cursor && cursor.row === r && cursor.col === c;
      bitmap.forEach((bits, y) => {
        const rowBits = cursorHere && y === GLYPH_HEIGHT - 1 ? 0b11111 : bits;
        for (let x = 0; x < GLYPH_WIDTH; x += 1) {
          if (rowBits & (1 << (GLYPH_WIDTH - 1 - x))) {
            lit.push({ x: PAD + c * CHAR_W + x, y: PAD + r * CHAR_H + y });
          }
        }
      });
    });
  });

  const vars = {
    "--lcd-glass": palette.glass,
    "--lcd-pixel": palette.pixel,
    "--lcd-off": palette.off,
    "--lcd-frame": palette.frame,
  } as CSSProperties;

  return (
    <div
      data-slot="character-lcd"
      data-backlight={backlight}
      className={cn(
        "inline-block rounded-md bg-[var(--lcd-frame)] p-2 shadow-[inset_0_1px_0_rgb(255_255_255/0.08),0_1px_2px_rgb(0_0_0/0.4)]",
        className,
      )}
      style={{ ...vars, ...style }}
      {...props}
    >
      <svg
        width={width * scale}
        height={height * scale}
        viewBox={`0 0 ${width} ${height}`}
        aria-hidden
        className="block rounded-[2px] transition-[filter] duration-300"
        style={{ filter: backlight ? undefined : "brightness(0.45) saturate(0.6)" }}
        shapeRendering="crispEdges"
      >
        <defs>
          <pattern
            id={`lcd-off-${color}`}
            width={1}
            height={1}
            patternUnits="userSpaceOnUse"
            x={PAD}
            y={PAD}
          >
            <rect width={PIXEL - GAP} height={PIXEL - GAP} fill="var(--lcd-off)" />
          </pattern>
        </defs>
        <rect width={width} height={height} fill="var(--lcd-glass)" />
        {text.map((_, r) =>
          Array.from({ length: cols }, (__, c) => (
            <rect
              key={`${r}-${c}`}
              x={PAD + c * CHAR_W}
              y={PAD + r * CHAR_H}
              width={GLYPH_WIDTH}
              height={GLYPH_HEIGHT}
              fill={`url(#lcd-off-${color})`}
            />
          )),
        )}
        {lit.map((p) => (
          <rect
            key={`${p.x}-${p.y}`}
            x={p.x}
            y={p.y}
            width={PIXEL - GAP}
            height={PIXEL - GAP}
            fill="var(--lcd-pixel)"
          />
        ))}
        {cursor?.blink ? (
          <rect
            x={PAD + cursor.col * CHAR_W}
            y={PAD + cursor.row * CHAR_H}
            width={GLYPH_WIDTH - GAP}
            height={GLYPH_HEIGHT - GAP}
            fill="var(--lcd-pixel)"
            className="motion-safe:animate-[benchcn-blink_1s_steps(1,end)_infinite]"
          />
        ) : null}
      </svg>
      <span className="sr-only">{label ?? text.map((t) => t.trimEnd()).join(" / ")}</span>
    </div>
  );
}
