import { describe, expect, it } from "vitest";

import { rotaryEncoderStatus } from "./rotary-encoder";

describe("rotaryEncoderStatus", () => {
  it("should say Not sent while the knob is still turning", () => {
    // #given
    const props = { commanded: 5, confirmed: 5, pending: false, error: null };

    // #when / #then
    expect(rotaryEncoderStatus(props, 6, 0.5)).toBe("draft");
  });

  it("should report a mismatch when the device clamped the value", () => {
    // #given
    const props = { commanded: 32, confirmed: 30, pending: false, error: null };

    // #when / #then
    expect(rotaryEncoderStatus(props, null, 0.5)).toBe("mismatch");
  });
});
