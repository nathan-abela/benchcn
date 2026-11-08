import { describe, expect, it } from "vitest";

import { addReading, EMPTY_STATS, meanOf } from "./meter-readout";

describe("addReading", () => {
  it("should track min, max and the running mean", () => {
    // #when
    const stats = [4.98, 5.02, 5.0].reduce(addReading, EMPTY_STATS);

    // #then
    expect({ min: stats.min, max: stats.max, mean: meanOf(stats)?.toFixed(3) }).toEqual({
      min: 4.98,
      max: 5.02,
      mean: "5.000",
    });
  });

  it("should ignore readings that are not finite", () => {
    // #when
    const stats = [5, Number.NaN, Number.POSITIVE_INFINITY].reduce(addReading, EMPTY_STATS);

    // #then
    expect(stats.count).toBe(1);
  });
});

describe("meanOf", () => {
  it("should be null before the first reading", () => {
    // #when / #then
    expect(meanOf(EMPTY_STATS)).toBeNull();
  });
});
