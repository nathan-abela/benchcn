import { describe, expect, it } from "vitest";

import { parseWave, waveLength } from "./wavejson";

describe("parseWave", () => {
  it("should extend the previous segment on a dot", () => {
    // #when
    const segments = parseWave("1..0");

    // #then
    expect(segments.map((s) => [s.kind, s.start, s.end])).toEqual([
      ["high", 0, 3],
      ["low", 3, 4],
    ]);
  });

  it("should take data labels in order", () => {
    // #when
    const segments = parseWave("x=.=x", ["A0", "D1"]);

    // #then
    expect(segments.filter((s) => s.kind === "data").map((s) => [s.label, s.start, s.end])).toEqual(
      [
        ["A0", 1, 3],
        ["D1", 3, 4],
      ],
    );
  });

  it("should map digits to colour slots", () => {
    // #when
    const segments = parseWave("23", ["a", "b"]);

    // #then
    expect(segments.map((s) => s.color)).toEqual([1, 2]);
  });

  it("should emit zero-width gaps", () => {
    // #when
    const segments = parseWave("1|1");

    // #then
    expect(segments.map((s) => [s.kind, s.start, s.end])).toEqual([
      ["high", 0, 1],
      ["gap", 1, 1],
      ["high", 1, 2],
    ]);
  });

  it("should scale by period", () => {
    // #when
    const segments = parseWave("p.", [], 2);

    // #then
    expect(segments).toEqual([{ kind: "clock-pos", start: 0, end: 4 }]);
  });

  it("should skip unknown characters", () => {
    // #when / #then
    expect(parseWave("1?0").map((s) => s.kind)).toEqual(["high", "low"]);
  });
});

describe("waveLength", () => {
  it("should return the longest signal including phase", () => {
    // #when / #then
    expect(
      waveLength([
        { name: "a", wave: "1..." },
        { name: "b", wave: "0.", phase: 3 },
      ]),
    ).toBe(5);
  });
});
