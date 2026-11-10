import { describe, expect, it } from "vitest";

import { applyDeadzone, clampToCircle, keysToVector } from "./joystick";

describe("clampToCircle", () => {
  it("should keep a diagonal no faster than straight ahead", () => {
    // #when
    const v = clampToCircle({ x: 1, y: 1 });

    // #then
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(1);
  });
});

describe("applyDeadzone", () => {
  it("should ignore stick drift inside the deadzone", () => {
    // #when / #then
    expect(applyDeadzone({ x: 0.05, y: -0.08 }, 0.12)).toEqual({ x: 0, y: 0 });
  });

  it("should rescale so full travel still reaches 1", () => {
    // #when
    const v = applyDeadzone({ x: 0, y: 1 }, 0.12);

    // #then
    expect(v).toEqual({ x: 0, y: 1 });
  });
});

describe("keysToVector", () => {
  it("should drive forward and turn with W and D together, clamped to the circle", () => {
    // #when
    const v = keysToVector(["w", "d"]);

    // #then
    expect([v.x.toFixed(3), v.y.toFixed(3)]).toEqual(["0.707", "0.707"]);
  });

  it("should cancel opposite keys instead of adding them", () => {
    // #when / #then
    expect(keysToVector(["ArrowUp", "ArrowDown"])).toEqual({ x: 0, y: 0 });
  });

  it("should accept capital letters from Shift or Caps Lock", () => {
    // #when / #then
    expect(keysToVector(["S"])).toEqual({ x: 0, y: -1 });
  });
});
