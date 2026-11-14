import { describe, expect, it } from "vitest";

import { createRateLimiter, createRepeater, createSettle, type PacingTimers } from "./pacing";

function manualClock(): PacingTimers & { advance(ms: number): void } {
  let time = 0;
  let timers: { at: number; fn: () => void; id: number }[] = [];
  let nextId = 0;
  return {
    now: () => time,
    setTimeout(fn, ms) {
      nextId += 1;
      timers.push({ at: time + ms, fn, id: nextId });
      return nextId;
    },
    clearTimeout(handle) {
      timers = timers.filter((t) => t.id !== handle);
    },
    advance(ms) {
      const end = time + ms;
      for (;;) {
        const due = timers.filter((t) => t.at <= end).sort((a, b) => a.at - b.at)[0];
        if (!due) break;
        timers = timers.filter((t) => t !== due);
        time = due.at;
        due.fn();
      }
      time = end;
    },
  };
}

describe("createRateLimiter", () => {
  it("should send the first value at once", () => {
    // #given
    const sent: number[] = [];
    const limiter = createRateLimiter((v: number) => sent.push(v), 50, manualClock());

    // #when
    limiter.push(1);

    // #then
    expect(sent).toEqual([1]);
  });

  it("should replace values inside the interval and end on the newest", () => {
    // #given
    const clock = manualClock();
    const sent: number[] = [];
    const limiter = createRateLimiter((v: number) => sent.push(v), 50, clock);

    // #when a drag produces five values in 20 ms
    for (const v of [1, 2, 3, 4, 5]) {
      limiter.push(v);
      clock.advance(5);
    }
    clock.advance(100);

    // #then
    expect(sent).toEqual([1, 5]);
  });

  it("should drop the waiting value on cancel", () => {
    // #given
    const clock = manualClock();
    const sent: number[] = [];
    const limiter = createRateLimiter((v: number) => sent.push(v), 50, clock);
    limiter.push(1);
    limiter.push(2);

    // #when the release commits the final value another way
    limiter.cancel();
    clock.advance(100);

    // #then
    expect(sent).toEqual([1]);
  });
});

describe("createSettle", () => {
  it("should commit once, after input goes quiet", () => {
    // #given
    const clock = manualClock();
    const committed: number[] = [];
    const settle = createSettle((v: number) => committed.push(v), 300, clock);

    // #when three detents arrive 100 ms apart
    settle.push(1);
    clock.advance(100);
    settle.push(2);
    clock.advance(100);
    settle.push(3);
    clock.advance(300);

    // #then
    expect(committed).toEqual([3]);
  });

  it("should commit a waiting value at once on flush", () => {
    // #given
    const committed: number[] = [];
    const settle = createSettle((v: number) => committed.push(v), 300, manualClock());
    settle.push(7);

    // #when focus leaves the control
    settle.flush();

    // #then
    expect(committed).toEqual([7]);
  });
});

describe("createRepeater", () => {
  it("should fire at once, then after the delay, then every interval", () => {
    // #given
    const clock = manualClock();
    const fired: number[] = [];
    const repeater = createRepeater(
      () => fired.push(clock.now!()),
      { delay: 400, interval: 100 },
      clock,
    );

    // #when held for 650 ms
    repeater.start();
    clock.advance(650);

    // #then
    expect(fired).toEqual([0, 400, 500, 600]);
  });

  it("should not fire again after stop", () => {
    // #given
    const clock = manualClock();
    let count = 0;
    const repeater = createRepeater(() => (count += 1), { delay: 400, interval: 100 }, clock);
    repeater.start();

    // #when
    repeater.stop();
    clock.advance(1000);

    // #then
    expect(count).toBe(1);
  });

  it("should ignore a second start while already running", () => {
    // #given
    const clock = manualClock();
    let count = 0;
    const repeater = createRepeater(() => (count += 1), { delay: 400, interval: 100 }, clock);

    // #when a key-down and a pointer-down overlap
    repeater.start();
    repeater.start();

    // #then
    expect(count).toBe(1);
  });
});
