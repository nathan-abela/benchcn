// benchcn.dev · bitmap
// A one-bit framebuffer with the drawing calls firmware graphics libraries have: pixels, lines,
// rectangles and 5x8 text. Converts to and from the SSD1306 display RAM layout. No DOM.
import {
  GLYPH_HEIGHT,
  GLYPH_WIDTH,
  glyphFor,
  HD44780_A00,
} from "@/registry/benchcn/lib/hd44780-rom";

// The ROM has no degree sign; firmware uses the ring at 0xDF for it.
const DEGREE_CODE = 0xdf;

function glyph(char: string): number[] {
  return char === "°" ? HD44780_A00[DEGREE_CODE] : glyphFor(char);
}

/** Row-major, one byte per pixel, 0 or 1. */
export type Bitmap = { width: number; height: number; data: Uint8Array };

export type TextOptions = {
  /** Whole-number magnification of the 5x8 glyphs. */
  scale?: number;
  on?: boolean;
};

/** Columns per character at scale 1: five of glyph and one of spacing. */
export const CHAR_ADVANCE = GLYPH_WIDTH + 1;

export function createBitmap(width: number, height: number): Bitmap {
  return { width, height, data: new Uint8Array(width * height) };
}

export function clearBitmap(bitmap: Bitmap, on = false): void {
  bitmap.data.fill(on ? 1 : 0);
}

export function getPixel(bitmap: Bitmap, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= bitmap.width || y >= bitmap.height) return false;
  return bitmap.data[y * bitmap.width + x] === 1;
}

/** Pixels outside the bitmap are ignored, so shapes can run off the edge. */
export function setPixel(bitmap: Bitmap, x: number, y: number, on = true): void {
  const px = Math.round(x);
  const py = Math.round(y);
  if (px < 0 || py < 0 || px >= bitmap.width || py >= bitmap.height) return;
  bitmap.data[py * bitmap.width + px] = on ? 1 : 0;
}

export function fillRect(
  bitmap: Bitmap,
  x: number,
  y: number,
  width: number,
  height: number,
  on = true,
): void {
  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) setPixel(bitmap, x + col, y + row, on);
  }
}

export function drawRect(
  bitmap: Bitmap,
  x: number,
  y: number,
  width: number,
  height: number,
  on = true,
): void {
  fillRect(bitmap, x, y, width, 1, on);
  fillRect(bitmap, x, y + height - 1, width, 1, on);
  fillRect(bitmap, x, y, 1, height, on);
  fillRect(bitmap, x + width - 1, y, 1, height, on);
}

/** Bresenham's line, both end points included. */
export function drawLine(
  bitmap: Bitmap,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  on = true,
): void {
  let x = Math.round(x0);
  let y = Math.round(y0);
  const endX = Math.round(x1);
  const endY = Math.round(y1);
  const dx = Math.abs(endX - x);
  const dy = -Math.abs(endY - y);
  const stepX = x < endX ? 1 : -1;
  const stepY = y < endY ? 1 : -1;
  let error = dx + dy;

  for (;;) {
    setPixel(bitmap, x, y, on);
    if (x === endX && y === endY) return;
    const doubled = 2 * error;
    if (doubled >= dy) {
      error += dy;
      x += stepX;
    }
    if (doubled <= dx) {
      error += dx;
      y += stepY;
    }
  }
}

/** Width in pixels of `text` drawn with `drawText`, without the trailing column of spacing. */
export function textWidth(text: string, scale = 1): number {
  const count = Array.from(text).length;
  return count === 0 ? 0 : (count * CHAR_ADVANCE - 1) * scale;
}

/**
 * Draws `text` with its top left corner at `x`, `y` in the HD44780 5x8 font. Only lit pixels are
 * written, so text can sit over other drawing. Returns the x of the next character.
 */
export function drawText(
  bitmap: Bitmap,
  text: string,
  x: number,
  y: number,
  { scale = 1, on = true }: TextOptions = {},
): number {
  let cursor = x;
  for (const char of text) {
    glyph(char).forEach((bits, row) => {
      for (let col = 0; col < GLYPH_WIDTH; col += 1) {
        if (bits & (1 << (GLYPH_WIDTH - 1 - col))) {
          fillRect(bitmap, cursor + col * scale, y + row * scale, scale, scale, on);
        }
      }
    });
    cursor += CHAR_ADVANCE * scale;
  }
  return cursor;
}

/** A bitmap exactly as wide as `text`, one glyph tall. */
export function textBitmap(text: string, scale = 1): Bitmap {
  const bitmap = createBitmap(Math.max(1, textWidth(text, scale)), GLYPH_HEIGHT * scale);
  drawText(bitmap, text, 0, 0, { scale });
  return bitmap;
}

/**
 * Copies a `width` wide window of `source` starting at column `offset`. Columns outside the
 * source are blank, so a negative offset slides the content in from the right.
 */
export function windowBitmap(
  source: Bitmap,
  offset: number,
  width: number,
  height: number,
): Bitmap {
  const out = createBitmap(width, height);
  for (let y = 0; y < Math.min(height, source.height); y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (getPixel(source, x + offset, y)) out.data[y * width + x] = 1;
    }
  }
  return out;
}

/**
 * Reads SSD1306 display RAM: one byte per column of each 8 pixel page, least significant bit at
 * the top, so pixel (x, y) is bit `y & 7` of byte `x + (y >> 3) * width`. This is the buffer
 * the Adafruit_SSD1306 driver keeps and sends (drawPixel in Adafruit_SSD1306.cpp).
 */
export function fromSsd1306(buffer: ArrayLike<number>, width = 128, height = 64): Bitmap {
  const bitmap = createBitmap(width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const byte = buffer[x + (y >> 3) * width] ?? 0;
      bitmap.data[y * width + x] = (byte >> (y & 7)) & 1;
    }
  }
  return bitmap;
}

/** The inverse of `fromSsd1306`: `width * ceil(height / 8)` bytes. */
export function toSsd1306(bitmap: Bitmap): Uint8Array {
  const { width, height, data } = bitmap;
  const buffer = new Uint8Array(width * Math.ceil(height / 8));
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[y * width + x]) buffer[x + (y >> 3) * width] |= 1 << (y & 7);
    }
  }
  return buffer;
}
