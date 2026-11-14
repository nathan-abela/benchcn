import { describe, expect, it } from "vitest";

import { detentsFromTravel, fractionOf, roundTo, stepValue } from "./stepper";

describe("stepValue", () => {
  it("should land ten steps of 0.1 exactly on 1", () => {
    // #when
    const value = stepValue(0, 10, { min: 0, max: 5, step: 0.1 });

    // #then
    expect(value).toBe(1);
  });

  it("should stop at max instead of overshooting", () => {
    // #when / #then
    expect(stepValue(29.5, 3, { min: 0, max: 30, step: 0.5 })).toBe(30);
  });

  it("should snap an off-grid value onto the grid anchored at min", () => {
    // #given a value the device rounded to something between steps
    const range = { min: 0.05, max: 3, step: 0.1 };

    // #when
    const value = stepValue(1.12, 1, range);

    // #then
    expect(value).toBe(1.25);
  });

  it("should come round from max to min when wrapping", () => {
    // #when / #then
    expect(stepValue(359, 1, { min: 0, max: 359, step: 1, wrap: true })).toBe(0);
  });

  it("should wrap backwards from min to max", () => {
    // #when / #then
    expect(stepValue(1, -1, { min: 1, max: 16, step: 1, wrap: true })).toBe(16);
  });
});

describe("fractionOf", () => {
  it("should clamp values outside the range", () => {
    // #when / #then
    expect([fractionOf(-5, 0, 10), fractionOf(15, 0, 10)]).toEqual([0, 1]);
  });

  it("should not divide by zero on an empty range", () => {
    // #when / #then
    expect(fractionOf(3, 3, 3)).toBe(0);
  });
});

describe("detentsFromTravel", () => {
  it("should keep the leftover travel for the next move", () => {
    // #when / #then
    expect(detentsFromTravel(-31, 12)).toEqual({ detents: -2, remainder: -7 });
  });
});

describe("roundTo", () => {
  it("should remove binary drift", () => {
    // #when / #then
    expect(roundTo(0.1 + 0.2, 1)).toBe(0.3);
  });
});
