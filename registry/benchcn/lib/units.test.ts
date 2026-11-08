import { describe, expect, it } from "vitest";

import { celsiusToFahrenheit, formatSi, stepValue } from "./units";

describe("formatSi", () => {
  it("should scale sub-millisecond times to microseconds", () => {
    // #when / #then
    expect(formatSi(0.00025, "s")).toBe("250 µs");
  });

  it("should keep three significant digits across prefixes", () => {
    // #when / #then
    expect([formatSi(1000, "Hz"), formatSi(1.65, "V"), formatSi(0.02, "V")]).toEqual([
      "1.00 kHz",
      "1.65 V",
      "20.0 mV",
    ]);
  });

  it("should roll up when rounding reaches the next prefix", () => {
    // #given a value that rounds to 1000 at three digits
    const text = formatSi(999.7, "Hz");

    // #then
    expect(text).toBe("1.00 kHz");
  });

  it("should keep the sign", () => {
    // #when / #then
    expect(formatSi(-0.5, "V")).toBe("-500 mV");
  });

  it("should print zero and non-finite values plainly", () => {
    // #when / #then
    expect([formatSi(0, "V"), formatSi(Number.NaN, "Hz")]).toEqual(["0 V", "-- Hz"]);
  });
});

describe("celsiusToFahrenheit", () => {
  it("should map the freezing and boiling points of water", () => {
    // #given
    const celsius = [0, 100, -40];

    // #when
    const fahrenheit = celsius.map(celsiusToFahrenheit);

    // #then
    expect(fahrenheit).toEqual([32, 212, -40]);
  });
});

describe("stepValue", () => {
  it("should step up the 1-2-5 series", () => {
    // #when / #then
    expect([stepValue(0.0002, 1), stepValue(0.0005, 1), stepValue(1, 1)]).toEqual([
      0.0005, 0.001, 2,
    ]);
  });

  it("should step down across a decade boundary", () => {
    // #when / #then
    expect(stepValue(0.001, -1)).toBe(0.0005);
  });

  it("should snap an off-series value to its nearest neighbour before stepping", () => {
    // #given 0.3 sits between 0.2 and 0.5, nearer 0.2 on a log scale
    const next = stepValue(0.3, 1);

    // #then
    expect(next).toBe(0.5);
  });
});
