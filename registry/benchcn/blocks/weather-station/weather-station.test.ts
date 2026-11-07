import { describe, expect, it } from "vitest";

import { dewPoint, pressureTrend } from "./weather-station";

describe("dewPoint", () => {
  it("should match the textbook value for 20 degrees at 50 percent", () => {
    // #when / #then (Magnus, Sonntag constants: 9.3 °C)
    expect(dewPoint(20, 50)).toBeCloseTo(9.3, 1);
  });

  it("should equal the temperature at saturation", () => {
    // #when / #then
    expect(dewPoint(15, 100)).toBeCloseTo(15, 5);
  });
});

describe("pressureTrend", () => {
  it("should report steady with too little history", () => {
    // #when / #then
    expect(pressureTrend([1013, 1014])).toBe("steady");
  });

  it("should report rising and falling beyond half a hectopascal", () => {
    // #when / #then
    expect([
      pressureTrend([1010, 1011, 1012, 1013]),
      pressureTrend([1013, 1012, 1011, 1010]),
    ]).toEqual(["rising", "falling"]);
  });
});
