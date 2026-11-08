import { describe, expect, it } from "vitest";

import {
  nearestPoint,
  splitAtGaps,
  type StripPoint,
  ticks,
  toCsv,
  valueRange,
  visibleSlice,
} from "./strip-chart";

const at = (pairs: [number, number][]): StripPoint[] => pairs.map(([t, v]) => ({ t, v }));

describe("visibleSlice", () => {
  it("should keep one point either side of the window so lines reach both edges", () => {
    // #given
    const points = at([
      [0, 1],
      [1000, 2],
      [2000, 3],
      [3000, 4],
      [4000, 5],
    ]);

    // #when
    const slice = visibleSlice(points, 1500, 2500);

    // #then
    expect(slice.map((p) => p.t)).toEqual([1000, 2000, 3000]);
  });
});

describe("valueRange", () => {
  it("should pad the data extent so the trace never touches the frame", () => {
    // #given
    const points = [
      at([
        [0, 10],
        [1, 20],
      ]),
    ];

    // #when
    const range = valueRange(points);

    // #then
    expect(range).toEqual({ min: 9.2, max: 20.8 });
  });

  it("should give a flat line a band instead of a zero-height range", () => {
    // #given
    const points = [
      at([
        [0, 40],
        [1, 40],
      ]),
    ];

    // #when
    const range = valueRange(points);

    // #then
    expect(range).toEqual({ min: 38, max: 42 });
  });

  it("should prefer fixed bounds over the data", () => {
    // #given
    const points = [at([[0, 55]])];

    // #when
    const range = valueRange(points, { min: 0, max: 100 });

    // #then
    expect(range).toEqual({ min: 0, max: 100 });
  });

  it("should return null when there is nothing to scale", () => {
    // #when / #then
    expect(valueRange([[]])).toBeNull();
  });
});

describe("ticks", () => {
  it("should land on a 1, 2 or 5 step inside the range", () => {
    // #when / #then
    expect(ticks({ min: 9.2, max: 20.8 }, 4)).toEqual([10, 15, 20]);
  });
});

describe("splitAtGaps", () => {
  it("should break the line where samples stopped arriving", () => {
    // #given
    const points = at([
      [0, 1],
      [1000, 1],
      [9000, 1],
      [10000, 1],
    ]);

    // #when
    const runs = splitAtGaps(points, 3000);

    // #then
    expect(runs.map((run) => run.map((p) => p.t))).toEqual([
      [0, 1000],
      [9000, 10000],
    ]);
  });
});

describe("nearestPoint", () => {
  it("should pick the closest sample in time", () => {
    // #given
    const points = at([
      [0, 1],
      [1000, 2],
      [2000, 3],
    ]);

    // #when / #then
    expect(nearestPoint(points, 1400, 500)).toEqual({ t: 1000, v: 2 });
  });

  it("should return null inside a dropout rather than an old value", () => {
    // #given
    const points = at([
      [0, 1],
      [10000, 2],
    ]);

    // #when / #then
    expect(nearestPoint(points, 5000, 2000)).toBeNull();
  });
});

describe("toCsv", () => {
  it("should write one row per timestamp and leave missing samples empty", () => {
    // #given
    const series = [
      { id: "temp", unit: "°C", points: at([[0, 21.5]]) },
      {
        id: "soil",
        unit: "%",
        points: at([
          [0, 40],
          [1000, 41],
        ]),
      },
    ];

    // #when
    const csv = toCsv(series);

    // #then
    expect(csv).toBe(
      [
        "time,temp (°C),soil (%)",
        "1970-01-01T00:00:00.000Z,21.5,40",
        "1970-01-01T00:00:01.000Z,,41",
      ].join("\n"),
    );
  });

  it("should quote headers that contain commas", () => {
    // #given
    const series = [{ id: "a,b", points: at([[0, 1]]) }];

    // #when / #then
    expect(toCsv(series).split("\n")[0]).toBe('time,"a,b"');
  });
});
