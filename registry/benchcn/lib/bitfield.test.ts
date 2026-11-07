import { describe, expect, it } from "vitest";

import {
  fieldValue,
  formatBinary,
  formatHex,
  layoutBitfield,
  toggleBit,
  withFieldValue,
} from "./bitfield";

describe("layoutBitfield", () => {
  it("should place width-only fields LSB first", () => {
    // #when
    const fields = layoutBitfield(
      [
        { name: "mode", bits: 2 },
        { name: "osrs_p", bits: 3 },
      ],
      8,
    );

    // #then
    expect(fields.map((f) => [f.name, f.lsb, f.msb])).toEqual([
      ["mode", 0, 1],
      ["osrs_p", 2, 4],
      ["", 5, 7],
    ]);
  });

  it("should accept explicit ranges in either order and fill gaps with reserved bits", () => {
    // #when
    const fields = layoutBitfield(
      [
        { name: "en", bits: [7, 7] },
        { name: "div", bits: [3, 1] },
      ],
      8,
    );

    // #then
    expect(fields.map((f) => [f.name, f.lsb, f.msb, f.reserved])).toEqual([
      ["", 0, 0, true],
      ["div", 1, 3, false],
      ["", 4, 6, true],
      ["en", 7, 7, false],
    ]);
  });

  it("should reject overlapping fields", () => {
    // #when / #then
    expect(() =>
      layoutBitfield(
        [
          { name: "a", bits: [0, 3] },
          { name: "b", bits: [3, 4] },
        ],
        8,
      ),
    ).toThrow(/overlaps/);
  });

  it("should reject fields outside the register", () => {
    // #when / #then
    expect(() => layoutBitfield([{ name: "a", bits: 9 }], 8)).toThrow(/does not fit/);
  });
});

describe("fieldValue and withFieldValue", () => {
  it("should extract a field from a register value", () => {
    // #given ctrl_meas = 0b101_011_11
    const value = 0b10101111;

    // #when / #then
    expect(fieldValue(value, { lsb: 2, width: 3 })).toBe(0b011);
  });

  it("should replace a field without touching its neighbours", () => {
    // #when
    const next = withFieldValue(0b10101111, { lsb: 2, width: 3 }, 0b000);

    // #then
    expect(formatBinary(next, 8)).toBe("10100011");
  });

  it("should handle the top bit of a 32-bit register", () => {
    // #when / #then
    expect(fieldValue(0x80000001, { lsb: 31, width: 1 })).toBe(1);
  });
});

describe("toggleBit and formatting", () => {
  it("should flip a bit both ways", () => {
    // #when / #then
    expect([toggleBit(0b0100, 2), toggleBit(0b0000, 2)]).toEqual([0, 4]);
  });

  it("should pad hex to the register width", () => {
    // #when / #then
    expect([formatHex(0x1f, 16), formatHex(0xa, 8)]).toEqual(["0x001F", "0x0A"]);
  });
});
