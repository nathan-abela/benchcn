import { describe, expect, it } from "vitest";

import { createConfirmations, idsOfKind, sameValue } from "./topic-source";

describe("sameValue", () => {
  it("should accept a float32 round trip as the same number", () => {
    // #given 0.1 after passing through a float topic
    const reported = Math.fround(0.1);

    // #when
    const same = sameValue(0.1, reported);

    // #then
    expect(same).toBe(true);
  });

  it("should treat values outside the tolerance as different", () => {
    // #given

    // #when
    const results = [sameValue(10, 10.4, 0.5), sameValue(10, 10.6, 0.5), sameValue(true, 1)];

    // #then
    expect(results).toEqual([true, false, false]);
  });
});

describe("createConfirmations", () => {
  it("should acknowledge the latest command once, with the reported value", () => {
    // #given two commands for the same channel; only the second is still awaited
    const confirmations = createConfirmations(() => 0.5);
    confirmations.expect("shooter", 1, 1000);
    confirmations.expect("shooter", 2, 1500);

    // #when the robot reports a value within tolerance, twice
    const first = confirmations.observe("shooter", 1500.2);
    const second = confirmations.observe("shooter", 1500.2);

    // #then
    expect({ first, second }).toEqual({
      first: { ack: 2, ok: true, id: "shooter", v: 1500.2 },
      second: null,
    });
  });

  it("should forget pending commands on clear", () => {
    // #given
    const confirmations = createConfirmations();
    confirmations.expect("drive", 3, true);

    // #when
    confirmations.clear();

    // #then
    expect(confirmations.observe("drive", true)).toBeNull();
  });
});

describe("idsOfKind", () => {
  it("should treat channels without a kind as sensors", () => {
    // #given
    const channels = { battery: {}, drive: { kind: "actuator" as const } };

    // #when
    const sensors = idsOfKind(channels, "sensor");

    // #then
    expect(sensors).toEqual(["battery"]);
  });
});
