import { describe, expect, it } from "vitest";

import { type ActuatorTrackerOptions, createActuatorTracker } from "./actuator";

function fakeClock() {
  let time = 1000;
  const timers: { at: number; fn: () => void }[] = [];
  const options: ActuatorTrackerOptions = {
    now: () => time,
    setTimeout: (fn, ms) => {
      const timer = { at: time + ms, fn };
      timers.push(timer);
      return timer;
    },
    clearTimeout: (handle) => {
      const index = timers.indexOf(handle as (typeof timers)[number]);
      if (index >= 0) timers.splice(index, 1);
    },
  };
  const advance = (ms: number) => {
    time += ms;
    for (const timer of [...timers].sort((a, b) => a.at - b.at)) {
      if (timer.at <= time) {
        timers.splice(timers.indexOf(timer), 1);
        timer.fn();
      }
    }
  };
  return { options, advance };
}

describe("createActuatorTracker", () => {
  it("should confirm the commanded value and record latency on a matching ack", () => {
    // #given a pump command with nonce 7
    const clock = fakeClock();
    const tracker = createActuatorTracker({ timeout: 2000, ...clock.options });
    tracker.command(true, 7);

    // #when the ack arrives 250 ms later
    clock.advance(250);
    tracker.ack({ ack: 7, ok: true, v: true });

    // #then
    expect(tracker.get()).toMatchObject({
      commanded: true,
      confirmed: true,
      pending: false,
      error: null,
      latency: 250,
    });
  });

  it("should ignore acks for other nonces", () => {
    // #given
    const clock = fakeClock();
    const tracker = createActuatorTracker(clock.options);
    tracker.command(true, 7);

    // #when
    tracker.ack({ ack: 6, ok: true, v: true });

    // #then still waiting
    expect(tracker.get()).toMatchObject({ pending: true, confirmed: null });
  });

  it("should keep the old confirmed value and surface the error on a rejected command", () => {
    // #given a pump known to be off
    const clock = fakeClock();
    const tracker = createActuatorTracker(clock.options);
    tracker.report(false);
    tracker.command(true, 1);

    // #when
    tracker.ack({ ack: 1, ok: false, err: "overcurrent" });

    // #then
    expect(tracker.get()).toMatchObject({
      commanded: true,
      confirmed: false,
      pending: false,
      error: "overcurrent",
    });
  });

  it("should time out into the fail-safe state", () => {
    // #given a device whose fail-safe is off
    const clock = fakeClock();
    const tracker = createActuatorTracker({ timeout: 2000, failSafe: false, ...clock.options });
    tracker.command(true, 3);

    // #when nothing answers
    clock.advance(2000);

    // #then
    expect(tracker.get()).toMatchObject({
      commanded: true,
      confirmed: false,
      pending: false,
      error: "timeout",
    });
  });

  it("should leave confirmed unknown on timeout when there is no fail-safe", () => {
    // #given
    const clock = fakeClock();
    const tracker = createActuatorTracker({ timeout: 500, ...clock.options });
    tracker.command(true, 3);

    // #when
    clock.advance(500);

    // #then
    expect(tracker.get()).toMatchObject({ confirmed: null, error: "timeout" });
  });

  it("should ignore a late ack after the timeout fired", () => {
    // #given
    const clock = fakeClock();
    const tracker = createActuatorTracker({ timeout: 500, ...clock.options });
    tracker.command(true, 3);
    clock.advance(500);

    // #when
    tracker.ack({ ack: 3, ok: true, v: true });

    // #then
    expect(tracker.get()).toMatchObject({ confirmed: null, error: "timeout" });
  });

  it("should clear a previous error and timer when a new command goes out", () => {
    // #given a timed-out command
    const clock = fakeClock();
    const tracker = createActuatorTracker({ timeout: 500, ...clock.options });
    tracker.command(true, 3);
    clock.advance(500);

    // #when retrying
    tracker.command(true, 4);

    // #then
    expect(tracker.get()).toMatchObject({ pending: true, error: null });
  });

  it("should notify subscribers on every change", () => {
    // #given
    const clock = fakeClock();
    const tracker = createActuatorTracker(clock.options);
    const seen: boolean[] = [];
    tracker.subscribe((state) => seen.push(state.pending));

    // #when
    tracker.command(false, 9);
    tracker.ack({ ack: 9, ok: true });

    // #then
    expect(seen).toEqual([true, false]);
  });
});

describe("createActuatorTracker with a numeric setpoint", () => {
  it("should confirm the value the device acknowledged, even when it clamped the request", () => {
    // #given a setpoint of 40 sent with nonce 3
    const clock = fakeClock();
    const { now, setTimeout, clearTimeout } = clock.options;
    const tracker = createActuatorTracker<number>({ now, setTimeout, clearTimeout });
    tracker.command(40, 3);

    // #when the device applies its maximum instead
    clock.advance(120);
    tracker.ack({ ack: 3, ok: true, v: 35 });

    // #then commanded and confirmed disagree, which the UI shows as a mismatch
    expect(tracker.get()).toMatchObject({ commanded: 40, confirmed: 35, pending: false });
  });

  it("should fall back to a numeric fail-safe after a timeout", () => {
    // #given
    const clock = fakeClock();
    const { now, setTimeout, clearTimeout } = clock.options;
    const tracker = createActuatorTracker<number>({
      timeout: 1000,
      failSafe: 15,
      now,
      setTimeout,
      clearTimeout,
    });
    tracker.command(28, 4);

    // #when no ack arrives
    clock.advance(1000);

    // #then
    expect(tracker.get()).toMatchObject({ confirmed: 15, error: "timeout", pending: false });
  });
});
