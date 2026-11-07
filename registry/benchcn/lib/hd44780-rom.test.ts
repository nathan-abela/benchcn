import { describe, expect, it } from "vitest";

import {
  GLYPH_HEIGHT,
  GLYPH_WIDTH,
  glyphFor,
  HD44780_A00,
  HD44780_CODE_FOR_CHAR,
} from "./hd44780-rom";

const BLANK = [0, 0, 0, 0, 0, 0, 0, 0];

describe("HD44780_A00", () => {
  it("should define every glyph as eight rows of five-bit masks", () => {
    // #given
    const glyphs = Object.values(HD44780_A00);

    // #when
    const malformed = glyphs.filter(
      (rows) =>
        rows.length !== GLYPH_HEIGHT ||
        rows.some((row) => !Number.isInteger(row) || row < 0 || row >= 1 << GLYPH_WIDTH),
    );

    // #then
    expect(malformed).toEqual([]);
  });

  it("should cover the whole ASCII range 0x20-0x7F", () => {
    // #given
    const asciiCodes = Array.from({ length: 96 }, (_, i) => 0x20 + i);

    // #when
    const missing = asciiCodes.filter((code) => HD44780_A00[code] === undefined);

    // #then
    expect(missing).toEqual([]);
  });

  it("should render space as a blank cell", () => {
    // #when / #then
    expect(HD44780_A00[0x20]).toEqual(BLANK);
  });

  it("should draw the standard A at 0x41", () => {
    // #when / #then
    expect(HD44780_A00[0x41].slice(0, 2)).toEqual([0b01110, 0b10001]);
  });

  it("should put the Yen sign at 0x5C instead of a backslash", () => {
    // #given a backslash would mirror the slash glyph column-wise
    const mirroredSlash = HD44780_A00[0x2f].map(
      (row) =>
        ((row & 0b00001) << 4) |
        ((row & 0b00010) << 2) |
        (row & 0b00100) |
        ((row & 0b01000) >> 2) |
        ((row & 0b10000) >> 4),
    );

    // #when / #then
    expect(HD44780_A00[0x5c]).not.toEqual(mirroredSlash);
  });
});

describe("HD44780_CODE_FOR_CHAR", () => {
  it("should have no code for a backslash", () => {
    // #when / #then
    expect(HD44780_CODE_FOR_CHAR["\\"]).toBeUndefined();
  });

  it("should map the A00 arrow and Yen quirks", () => {
    // #when / #then
    expect([
      HD44780_CODE_FOR_CHAR["¥"],
      HD44780_CODE_FOR_CHAR["→"],
      HD44780_CODE_FOR_CHAR["←"],
    ]).toEqual([0x5c, 0x7e, 0x7f]);
  });
});

describe("glyphFor", () => {
  it("should return the 0x7E entry for the right arrow", () => {
    // #when / #then
    expect(glyphFor("→")).toEqual(HD44780_A00[0x7e]);
  });

  it("should return a blank glyph for an unknown character", () => {
    // #when / #then
    expect(glyphFor("\u0001")).toEqual(BLANK);
  });
});
