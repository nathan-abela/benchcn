import { describe, expect, it } from "vitest";

import { tweenWindow } from "./logic-analyzer";

describe("tweenWindow", () => {
  it("should start at the old window and land on the new one", () => {
    // #given
    const from = { start: 0, end: 4 };
    const to = { start: 10, end: 12 };

    // #when
    const ends = [tweenWindow(from, to, 0), tweenWindow(from, to, 1)];

    // #then
    expect(ends).toEqual([from, to]);
  });

  it("should pass through the geometric mean span halfway through a zoom", () => {
    // #given
    const from = { start: 0, end: 8 };
    const to = { start: 3, end: 5 };

    // #when
    const half = tweenWindow(from, to, 0.5);

    // #then
    expect([half.end - half.start, (half.start + half.end) / 2]).toEqual([4, 4]);
  });
});
