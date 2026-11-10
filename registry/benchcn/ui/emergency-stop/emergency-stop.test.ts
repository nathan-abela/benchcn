import { describe, expect, it } from "vitest";

import { emergencyStopStatus } from "./emergency-stop";

describe("emergencyStopStatus", () => {
  it("should say Stopping, not Stopped, until the device acknowledges", () => {
    // #when / #then
    expect(
      emergencyStopStatus({ commanded: true, confirmed: false, pending: true, error: null }),
    ).toBe("stopping");
  });

  it("should report engaged only once confirmed", () => {
    // #when / #then
    expect(
      emergencyStopStatus({ commanded: true, confirmed: true, pending: false, error: null }),
    ).toBe("engaged");
  });

  it("should never claim the stop worked when the command timed out", () => {
    // #when / #then
    expect(
      emergencyStopStatus({ commanded: true, confirmed: false, pending: false, error: "timeout" }),
    ).toBe("unconfirmed");
  });

  it("should show a reset in flight separately from a stop in flight", () => {
    // #when / #then
    expect(
      emergencyStopStatus({ commanded: false, confirmed: true, pending: true, error: null }),
    ).toBe("resetting");
  });
});
