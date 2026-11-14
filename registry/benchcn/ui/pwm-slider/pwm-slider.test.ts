import { describe, expect, it } from "vitest";

import { pwmSliderStatus } from "./pwm-slider";

describe("pwmSliderStatus", () => {
  it("should say Streaming while the thumb is dragged, whatever the device says", () => {
    // #given
    const props = { commanded: 40, confirmed: 20, pending: true, error: null };

    // #when / #then
    expect(pwmSliderStatus(props, true, 0.5)).toBe("streaming");
  });

  it("should confirm the release value once the device acknowledges it", () => {
    // #given
    const props = { commanded: 72, confirmed: 72, pending: false, error: null };

    // #when / #then
    expect(pwmSliderStatus(props, false, 0.5)).toBe("confirmed");
  });
});
