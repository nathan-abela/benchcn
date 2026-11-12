import { describe, expect, it } from "vitest";

import { defaultSignalThresholds, signalBars } from "./signal-bars";

describe("defaultSignalThresholds", () => {
  it("should split -100 to -55 dBm evenly across the bars", () => {
    // #when / #then
    expect(defaultSignalThresholds("dBm", 4)).toEqual([-88.75, -77.5, -66.25, -55]);
  });

  it("should use even steps for a quality percentage", () => {
    // #when / #then
    expect(defaultSignalThresholds("%", 4)).toEqual([20, 40, 60, 80]);
  });
});

describe("signalBars", () => {
  it("should match the AOSP Wi-Fi levels for RSSI", () => {
    // #given
    const thresholds = defaultSignalThresholds("dBm", 4);

    // #when
    const bars = [-110, -100, -89, -88, -67, -66, -55, -30].map((rssi) =>
      signalBars(rssi, thresholds),
    );

    // #then
    expect(bars).toEqual([0, 0, 0, 1, 2, 3, 4, 4]);
  });

  it("should light one bar per threshold reached", () => {
    // #when / #then
    expect(signalBars(-71, [-90, -80, -70])).toBe(2);
  });

  it("should light nothing without a reading", () => {
    // #when / #then
    expect([signalBars(null, [1]), signalBars(Number.NaN, [1])]).toEqual([0, 0]);
  });
});
