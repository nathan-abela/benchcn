import { describe, expect, it } from "vitest";

import { normalBand, rangeState, recentSpread, scalePosition } from "./range-bar";

const limits = { low: 10, warnBelow: 15, warnAbove: 30, high: 35 };

describe("rangeState", () => {
  it("should name each band from low alarm to high alarm", () => {
    // #given
    const values = [5, 12, 22, 32, 40];

    // #when
    const states = values.map((v) => rangeState(v, limits));

    // #then
    expect(states).toEqual(["low-alarm", "low", "normal", "high", "high-alarm"]);
  });

  it("should report no data for a missing value", () => {
    // #when / #then
    expect(rangeState(null, limits)).toBe("unknown");
  });
});

describe("scalePosition", () => {
  it("should place a value as a fraction of the scale", () => {
    // #when / #then
    expect(scalePosition(25, 0, 100)).toEqual({ at: 0.25, off: null });
  });

  it("should pin an off-scale value to the end and say which way it went", () => {
    // #when / #then
    expect([scalePosition(-5, 0, 100), scalePosition(140, 0, 100)]).toEqual([
      { at: 0, off: "below" },
      { at: 1, off: "above" },
    ]);
  });
});

describe("normalBand", () => {
  it("should run between the warning limits when they are set", () => {
    // #when / #then
    expect(normalBand(0, 50, limits)).toEqual({ from: 0.3, to: 0.6 });
  });

  it("should fall back to the alarm limits and then the scale ends", () => {
    // #when / #then
    expect(normalBand(0, 50, { high: 40 })).toEqual({ from: 0, to: 0.8 });
  });

  it("should be absent without thresholds", () => {
    // #when / #then
    expect(normalBand(0, 50)).toBeNull();
  });
});

describe("recentSpread", () => {
  it("should cover the lowest to the highest recent value", () => {
    // #when / #then
    expect(recentSpread([20, 25, 22], 0, 50)).toEqual({ from: 0.4, to: 0.5 });
  });

  it("should need at least two values", () => {
    // #when / #then
    expect(recentSpread([20], 0, 50)).toBeNull();
  });
});
