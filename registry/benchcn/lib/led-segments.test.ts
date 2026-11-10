import { describe, expect, it } from "vitest";

import { isSegmentLit, segmentsReached, segmentTone } from "./led-segments";

describe("segmentsReached", () => {
  it("should light a segment once the value reaches its step", () => {
    // #when
    const reached = [0, 9.9, 10, 30, 55, 100].map((value) => segmentsReached(value, 0, 100, 10));

    // #then
    expect(reached).toEqual([0, 0, 1, 3, 5, 10]);
  });

  it("should clamp values outside the range", () => {
    // #when / #then
    expect([segmentsReached(-5, 0, 100, 10), segmentsReached(140, 0, 100, 10)]).toEqual([0, 10]);
  });

  it("should work on a range that does not start at zero", () => {
    // #when / #then
    expect(segmentsReached(3.7, 3, 4.2, 12)).toBe(7);
  });

  it("should light nothing without a reading", () => {
    // #when / #then
    expect([
      segmentsReached(null, 0, 100, 10),
      segmentsReached(undefined, 0, 100, 10),
      segmentsReached(Number.NaN, 0, 100, 10),
    ]).toEqual([0, 0, 0]);
  });
});

describe("isSegmentLit", () => {
  it("should fill up to the value in bar mode", () => {
    // #when
    const lit = [0, 1, 2, 3, 4].map((index) => isSegmentLit(index, 3, "bar"));

    // #then
    expect(lit).toEqual([true, true, true, false, false]);
  });

  it("should light only the reached segment in dot mode", () => {
    // #when
    const lit = [0, 1, 2, 3, 4].map((index) => isSegmentLit(index, 3, "dot"));

    // #then
    expect(lit).toEqual([false, false, true, false, false]);
  });

  it("should light nothing in dot mode at the bottom of the range", () => {
    // #when / #then
    expect(isSegmentLit(0, 0, "dot")).toBe(false);
  });
});

describe("segmentTone", () => {
  it("should colour the segments above the upper limits", () => {
    // #given
    const thresholds = { warnAbove: 70, high: 90 };

    // #when
    const tones = Array.from({ length: 10 }, (_, index) =>
      segmentTone(index, 0, 100, 10, thresholds),
    );

    // #then
    expect(tones).toEqual([...Array<string>(7).fill("normal"), "warn", "warn", "alarm"]);
  });

  it("should colour the segments below the lower limits", () => {
    // #given
    const thresholds = { low: 10, warnBelow: 30 };

    // #when
    const tones = Array.from({ length: 5 }, (_, index) =>
      segmentTone(index, 0, 100, 10, thresholds),
    );

    // #then
    expect(tones).toEqual(["alarm", "warn", "warn", "normal", "normal"]);
  });

  it("should leave every segment normal without thresholds", () => {
    // #when / #then
    expect(segmentTone(9, 0, 100, 10)).toBe("normal");
  });
});
