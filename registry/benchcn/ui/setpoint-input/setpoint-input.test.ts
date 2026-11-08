import { describe, expect, it } from "vitest";

import { setpointStatus, validateSetpoint } from "./setpoint-input";

describe("validateSetpoint", () => {
  it("should accept a value inside the range", () => {
    // #when / #then
    expect(validateSetpoint("22.5", 15, 35, "°C")).toEqual({ value: 22.5, problem: null });
  });

  it("should accept a decimal comma", () => {
    // #when / #then
    expect(validateSetpoint("22,5", 15, 35).value).toBe(22.5);
  });

  it("should name the limit a value breaks, with its unit", () => {
    // #when / #then
    expect(validateSetpoint("40", 15, 35, "°C").problem).toBe("Max 35 °C");
  });

  it("should reject text that is not a number", () => {
    // #when / #then
    expect(validateSetpoint("warm", 15, 35)).toEqual({ value: null, problem: "Enter a number" });
  });
});

describe("setpointStatus", () => {
  it("should report a mismatch when the device applied a different value", () => {
    // #given the device clamped 40 to 35
    const props = { commanded: 40, confirmed: 35, pending: false, error: null };

    // #when / #then
    expect(setpointStatus(props, 0.25)).toBe("mismatch");
  });

  it("should treat a difference inside the tolerance as confirmed", () => {
    // #given the device rounded 22.4 to 22.5 with a 0.5 step
    const props = { commanded: 22.4, confirmed: 22.5, pending: false, error: null };

    // #when / #then
    expect(setpointStatus(props, 0.25)).toBe("confirmed");
  });

  it("should prefer pending over everything else", () => {
    // #given
    const props = { commanded: 30, confirmed: 20, pending: true, error: "timeout" };

    // #when / #then
    expect(setpointStatus(props, 0.25)).toBe("pending");
  });
});
