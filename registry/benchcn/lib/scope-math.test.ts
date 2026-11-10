import { describe, expect, it } from "vitest";

import { captureWindow, findLastTrigger, measure, moveCursor, readCursors } from "./scope-math";

const SAMPLE_RATE = 100_000;

function sine(frequency: number, length: number, amplitude = 1, offset = 0): Float32Array {
  const out = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    out[i] = offset + amplitude * Math.sin((2 * Math.PI * frequency * (i + 0.3)) / SAMPLE_RATE);
  }
  return out;
}

function square(frequency: number, length: number, duty = 0.5): Float32Array {
  const out = new Float32Array(length);
  const period = SAMPLE_RATE / frequency;
  for (let i = 0; i < length; i += 1) out[i] = (i % period) / period < duty ? 3.3 : 0;
  return out;
}

describe("findLastTrigger", () => {
  it("should return the newest rising crossing inside the range, interpolated", () => {
    // #given a ramp crossing zero between samples 2 and 3, and again between 6 and 7
    const values = [-2, -1, -0.5, 0.5, 1, -1, -0.5, 0.5, 1];

    // #when
    const index = findLastTrigger(values, 0, "rising", 0, values.length - 1);

    // #then
    expect(index).toBeCloseTo(6.5);
  });

  it("should find falling edges", () => {
    // #given
    const values = [1, 1, -1, -1];

    // #when
    const index = findLastTrigger(values, 0, "falling", 0, 3);

    // #then
    expect(index).toBeCloseTo(1.5);
  });

  it("should ignore crossings that never left the hysteresis band", () => {
    // #given noise of ±0.05 around the level
    const values = [-0.05, 0.05, -0.04, 0.04];

    // #when
    const index = findLastTrigger(values, 0, "rising", 0, 3, 0.2);

    // #then
    expect(index).toBe(-1);
  });

  it("should return -1 for an empty array", () => {
    // #when / #then
    expect(findLastTrigger([], 0, "rising", 0, 10)).toBe(-1);
  });
});

describe("captureWindow", () => {
  it("should place the trigger point at the pretrigger position", () => {
    // #given a 1 kHz sine and a 2 ms window with the trigger centred
    const values = sine(1000, 2000);

    // #when
    const capture = captureWindow(values, { windowLength: 200, pretrigger: 0.5, level: 0 });

    // #then the centre of the window sits between a negative and a positive sample
    const centre = capture!.start + 100;
    expect({
      triggered: capture!.triggered,
      before: values[Math.floor(centre)] < 0,
      after: values[Math.ceil(centre)] >= 0,
    }).toEqual({ triggered: true, before: true, after: true });
  });

  it("should fall back to the newest samples in auto mode when nothing crosses the level", () => {
    // #given a flat signal
    const values = new Float32Array(500).fill(0.2);

    // #when
    const capture = captureWindow(values, { windowLength: 100, level: 1 });

    // #then
    expect(capture).toEqual({ start: 400, triggered: false });
  });

  it("should return null in normal mode when nothing crosses the level", () => {
    // #when / #then
    expect(
      captureWindow(new Float32Array(500), { windowLength: 100, level: 1, mode: "normal" }),
    ).toBeNull();
  });

  it("should show everything when the buffer is shorter than the window", () => {
    // #when / #then
    expect(captureWindow([0, 1, 0], { windowLength: 10, level: 0.5 })).toEqual({
      start: 0,
      triggered: false,
    });
  });
});

describe("measure", () => {
  it("should measure the frequency of a sine to within 0.1 percent", () => {
    // #given 20 cycles of 1 kHz
    const values = sine(1000, 2000);

    // #when
    const { frequency } = measure(values, SAMPLE_RATE);

    // #then
    expect(frequency).toBeCloseTo(1000, 0);
  });

  it("should report peak to peak, mean and rms of a sine", () => {
    // #given 1 V amplitude around 0.5 V, whole cycles
    const values = sine(1000, 1000, 1, 0.5);

    // #when
    const m = measure(values, SAMPLE_RATE);

    // #then
    expect({ vpp: m.peakToPeak, mean: m.mean, rms: m.rms }).toEqual({
      vpp: expect.closeTo(2, 2),
      mean: expect.closeTo(0.5, 2),
      rms: expect.closeTo(Math.sqrt(0.5 + 0.25), 2),
    });
  });

  it("should measure the duty cycle of a square wave", () => {
    // #given a 30 percent duty cycle
    const values = square(1000, 2000, 0.3);

    // #when
    const { dutyCycle, period } = measure(values, SAMPLE_RATE);

    // #then
    expect({ dutyCycle, period }).toEqual({
      dutyCycle: expect.closeTo(0.3, 2),
      period: expect.closeTo(0.001, 6),
    });
  });

  it("should leave frequency null for a flat signal", () => {
    // #when
    const m = measure(new Float32Array(100).fill(1.5), SAMPLE_RATE);

    // #then
    expect({ frequency: m.frequency, mean: m.mean }).toEqual({ frequency: null, mean: 1.5 });
  });

  it("should respect the start and end bounds", () => {
    // #given
    const values = [10, 10, 1, 2, 3, 10, 10];

    // #when
    const m = measure(values, SAMPLE_RATE, 2, 5);

    // #then
    expect({ min: m.min, max: m.max }).toEqual({ min: 1, max: 3 });
  });

  it("should return zeros for an empty range", () => {
    // #when / #then
    expect(measure([], SAMPLE_RATE).peakToPeak).toBe(0);
  });
});

describe("readCursors", () => {
  it("should read time cursors relative to the trigger point", () => {
    // #given
    const timebase = 0.001;
    const triggerPosition = -2;

    // #when
    const readout = readCursors([-2, 3], timebase, triggerPosition);

    // #then
    expect(readout).toEqual({ a: 0, b: expect.closeTo(0.005, 9), delta: expect.closeTo(0.005, 9) });
  });

  it("should read voltage cursors through the channel scale and offset", () => {
    // #given
    const voltsPerDiv = 0.5;
    const offset = -1;

    // #when
    const readout = readCursors([1, -1], voltsPerDiv, offset);

    // #then
    expect(readout).toEqual({ a: 1, b: 0, delta: -1 });
  });
});

describe("moveCursor", () => {
  it("should move one cursor and leave the other", () => {
    // #when
    const next = moveCursor([-2, 2], 1, 3.5, 10);

    // #then
    expect(next).toEqual([-2, 3.5]);
  });

  it("should stop at the edge of the screen", () => {
    // #when
    const next = moveCursor([-2, 2], 0, -9, 8);

    // #then
    expect(next).toEqual([-4, 2]);
  });
});
