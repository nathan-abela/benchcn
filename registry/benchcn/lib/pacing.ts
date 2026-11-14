// benchcn.dev · pacing
// Timing for controls that send while the user is still moving: a rate limit that always ends on
// the newest value, a settle that waits for the hand to stop, and a held-key style auto-repeat.
// Clock and timers are injectable so tests can drive time by hand.

export type PacingTimers = {
  now?: () => number;
  setTimeout?: (fn: () => void, ms: number) => unknown;
  clearTimeout?: (handle: unknown) => void;
};

function timersFrom(timers: PacingTimers) {
  return {
    now: timers.now ?? (() => Date.now()),
    schedule: timers.setTimeout ?? ((fn: () => void, ms: number) => globalThis.setTimeout(fn, ms)),
    cancel: timers.clearTimeout ?? ((handle: unknown) => globalThis.clearTimeout(handle as number)),
  };
}

export type RateLimiter<T> = {
  /** Sends now if the interval has passed, otherwise keeps the value for the next slot. */
  push(value: T): void;
  /** Drops a value still waiting for its slot. */
  cancel(): void;
};

/** At most one send per `intervalMs`. Values in between are replaced, never queued. */
export function createRateLimiter<T>(
  send: (value: T) => void,
  intervalMs: number,
  timers: PacingTimers = {},
): RateLimiter<T> {
  const { now, schedule, cancel } = timersFrom(timers);
  let lastSent = Number.NEGATIVE_INFINITY;
  let waiting: { value: T } | null = null;
  let timer: unknown = null;

  const fire = () => {
    timer = null;
    if (!waiting) return;
    const { value } = waiting;
    waiting = null;
    lastSent = now();
    send(value);
  };

  return {
    push(value) {
      waiting = { value };
      const wait = lastSent + intervalMs - now();
      if (wait <= 0) {
        if (timer !== null) cancel(timer);
        fire();
      } else if (timer === null) {
        timer = schedule(fire, wait);
      }
    },
    cancel() {
      if (timer !== null) cancel(timer);
      timer = null;
      waiting = null;
    },
  };
}

export type Settle<T> = {
  /** Restarts the wait with the newest value. */
  push(value: T): void;
  /** Commits a waiting value straight away. */
  flush(): void;
  cancel(): void;
};

/** Commits once input has been quiet for `quietMs`. */
export function createSettle<T>(
  commit: (value: T) => void,
  quietMs: number,
  timers: PacingTimers = {},
): Settle<T> {
  const { schedule, cancel } = timersFrom(timers);
  let waiting: { value: T } | null = null;
  let timer: unknown = null;

  const clear = () => {
    if (timer !== null) cancel(timer);
    timer = null;
  };
  const flush = () => {
    clear();
    if (!waiting) return;
    const { value } = waiting;
    waiting = null;
    commit(value);
  };

  return {
    push(value) {
      waiting = { value };
      clear();
      if (quietMs <= 0) flush();
      else timer = schedule(flush, quietMs);
    },
    flush,
    cancel() {
      clear();
      waiting = null;
    },
  };
}

export type Repeater = {
  /** Fires once now, then again after `delay` and every `interval` until stopped. */
  start(): void;
  stop(): void;
};

export function createRepeater(
  fire: () => void,
  { delay, interval }: { delay: number; interval: number },
  timers: PacingTimers = {},
): Repeater {
  const { schedule, cancel } = timersFrom(timers);
  let timer: unknown = null;
  let active = false;

  const next = (ms: number) => {
    timer = schedule(() => {
      if (!active) return;
      fire();
      next(interval);
    }, ms);
  };

  return {
    start() {
      if (active) return;
      active = true;
      fire();
      next(delay);
    },
    stop() {
      active = false;
      if (timer !== null) cancel(timer);
      timer = null;
    },
  };
}
