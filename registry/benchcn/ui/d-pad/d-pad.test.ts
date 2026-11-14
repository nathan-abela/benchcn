import { describe, expect, it } from "vitest";

import { jogMove } from "./d-pad";

describe("jogMove", () => {
  it("should move up along positive y", () => {
    // #when / #then
    expect(jogMove("up", 0.1)).toEqual({ direction: "up", x: 0, y: 0.1 });
  });

  it("should move left along negative x", () => {
    // #when / #then
    expect(jogMove("left", 10)).toEqual({ direction: "left", x: -10, y: 0 });
  });
});
