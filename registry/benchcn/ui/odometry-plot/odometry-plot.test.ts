import { describe, expect, it } from "vitest";

import { fitView, gridStep } from "./odometry-plot";

describe("fitView", () => {
  it("should hold the minimum span for a robot that has not moved", () => {
    // #when / #then
    expect(fitView([], { x: 0, y: 0 }, 1)).toEqual({ cx: 0, cy: 0, half: 1 });
  });

  it("should centre on the path and keep a margin around it", () => {
    // #given a path four metres long along x
    const path = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
    ];

    // #when
    const view = fitView(path, null, 1);

    // #then
    expect(view).toEqual({ cx: 2, cy: 0, half: 2.3 });
  });

  it("should include the current pose even before it joins the path", () => {
    // #when
    const view = fitView([{ x: 0, y: 0 }], { x: 0, y: 6 }, 1);

    // #then
    expect(view.cy).toBe(3);
  });
});

describe("gridStep", () => {
  it("should land on a 1, 2 or 5 step", () => {
    // #when / #then
    expect([gridStep(1), gridStep(2.3), gridStep(20)]).toEqual([0.5, 1, 10]);
  });
});
