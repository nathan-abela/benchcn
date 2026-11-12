import { describe, expect, it } from "vitest";

import { batteryPercent, batteryState } from "./battery";

describe("batteryPercent", () => {
  it("should pass a percentage through, clamped", () => {
    // #when
    const percents = [-4, 0, 62.5, 100, 130].map((value) => batteryPercent(value));

    // #then
    expect(percents).toEqual([0, 0, 62.5, 100, 100]);
  });

  it("should map volts linearly from min to max", () => {
    // #when
    const percent = batteryPercent(3.6, { unit: "V", min: 3.0, max: 4.2 });

    // #then
    expect(percent).toBeCloseTo(50);
  });

  it("should interpolate volts along a curve given in any order", () => {
    // #given
    const curve = [
      [4.2, 100],
      [3.0, 0],
      [3.7, 50],
    ] as const;

    // #when
    const percents = [2.8, 3.35, 3.95, 4.4].map((v) => batteryPercent(v, { unit: "V", curve }));

    // #then
    expect(percents.map((p) => Math.round(p ?? -1))).toEqual([0, 25, 75, 100]);
  });

  it("should return null without a reading or with an empty scale", () => {
    // #when / #then
    expect([
      batteryPercent(null),
      batteryPercent(undefined),
      batteryPercent(Number.NaN),
      batteryPercent(3.7, { unit: "V", min: 4, max: 4 }),
    ]).toEqual([null, null, null, null]);
  });
});

describe("batteryState", () => {
  it("should be low and critical at or below the default limits", () => {
    // #when
    const states = [50, 20, 15, 10, 0].map((percent) => batteryState(percent));

    // #then
    expect(states).toEqual(["normal", "low", "low", "critical", "critical"]);
  });

  it("should take custom limits", () => {
    // #when / #then
    expect(batteryState(28, { low: 30, critical: 5 })).toBe("low");
  });

  it("should be unknown without a percentage", () => {
    // #when / #then
    expect(batteryState(null)).toBe("unknown");
  });
});
