import { describe, expect, it } from "vitest";

import { momentaryStatus } from "./momentary-button";

describe("momentaryStatus", () => {
  it("should report Still on when the device is on after the release", () => {
    // #given the off command timed out and the device still reports on
    const props = { commanded: false, confirmed: true, pending: false, error: "timeout" };

    // #when / #then
    expect(momentaryStatus(props)).toBe("stuck");
  });

  it("should report on only once the device confirms it while held", () => {
    // #given
    const props = { commanded: true, confirmed: true, pending: false, error: null };

    // #when / #then
    expect(momentaryStatus(props)).toBe("on");
  });

  it("should report a mismatch when the device refused to turn on", () => {
    // #given
    const props = { commanded: true, confirmed: false, pending: false, error: null };

    // #when / #then
    expect(momentaryStatus(props)).toBe("mismatch");
  });

  it("should wait while a command is in flight", () => {
    // #given
    const props = { commanded: false, confirmed: true, pending: true, error: null };

    // #when / #then
    expect(momentaryStatus(props)).toBe("pending");
  });
});
