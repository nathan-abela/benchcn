// benchcn.dev · actuator
// Tracks one actuator or setpoint through the command/acknowledge round trip so the UI can tell
// what was asked for apart from what the device confirmed. Pure, with an injectable clock for tests.
export type ActuatorValue = boolean | number;

export type ActuatorState<T extends ActuatorValue = boolean> = {
  /** What the user last asked for. */
  commanded: T | null;
  /** What the device last reported. `null` until the first acknowledgement or report. */
  confirmed: T | null;
  pending: boolean;
  /** `"timeout"`, or the device's error text for a rejected command. */
  error: string | null;
  /** Round-trip time of the last acknowledgement, in milliseconds. */
  latency: number | null;
  /** Clock time of the last change. */
  updatedAt: number;
};

export type ActuatorAck = {
  ack: number;
  ok: boolean;
  v?: unknown;
  err?: string;
};

export type ActuatorTrackerOptions<T extends ActuatorValue = boolean> = {
  /** Milliseconds to wait for an acknowledgement. */
  timeout?: number;
  /** State the device falls back to on its own when it loses the link; shown after a timeout. */
  failSafe?: T | null;
  now?: () => number;
  setTimeout?: (fn: () => void, ms: number) => unknown;
  clearTimeout?: (handle: unknown) => void;
};

export type ActuatorTracker<T extends ActuatorValue = boolean> = {
  get(): ActuatorState<T>;
  subscribe(listener: (state: ActuatorState<T>) => void): () => void;
  /** Records a request that went out with this nonce and starts the timeout. */
  command(value: T, nonce: number): void;
  /** Feed every acknowledgement; those for other nonces are ignored. */
  ack(ack: ActuatorAck): void;
  /** State the device reported outside an acknowledgement, such as a telemetry sample. */
  report(value: T): void;
  dispose(): void;
};

export const INITIAL_ACTUATOR_STATE: ActuatorState<never> = {
  commanded: null,
  confirmed: null,
  pending: false,
  error: null,
  latency: null,
  updatedAt: 0,
};

export function createActuatorTracker<T extends ActuatorValue = boolean>(
  options: ActuatorTrackerOptions<T> = {},
): ActuatorTracker<T> {
  const {
    timeout = 2000,
    failSafe = null,
    now = () => Date.now(),
    setTimeout: schedule = (fn, ms) => globalThis.setTimeout(fn, ms),
    clearTimeout: cancel = (handle) => globalThis.clearTimeout(handle as number),
  } = options;

  let state: ActuatorState<T> = INITIAL_ACTUATOR_STATE;
  let nonce: number | null = null;
  let sentAt = 0;
  let timer: unknown = null;
  const listeners = new Set<(state: ActuatorState<T>) => void>();

  const set = (patch: Partial<ActuatorState<T>>) => {
    state = { ...state, ...patch, updatedAt: now() };
    for (const listener of listeners) listener(state);
  };

  const clearTimer = () => {
    if (timer !== null) cancel(timer);
    timer = null;
  };

  return {
    get: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    command(value, n) {
      clearTimer();
      nonce = n;
      sentAt = now();
      set({ commanded: value, pending: true, error: null });
      timer = schedule(() => {
        timer = null;
        nonce = null;
        set({
          pending: false,
          error: "timeout",
          confirmed: failSafe === null ? state.confirmed : failSafe,
        });
      }, timeout);
    },
    ack(ack) {
      if (nonce === null || ack.ack !== nonce) return;
      clearTimer();
      nonce = null;
      const latency = now() - sentAt;
      if (ack.ok) {
        set({
          pending: false,
          // A device may clamp or round; what it acknowledges wins over what was asked.
          confirmed: typeof ack.v === typeof state.commanded ? (ack.v as T) : state.commanded,
          error: null,
          latency,
        });
      } else {
        set({ pending: false, error: ack.err ?? "rejected", latency });
      }
    },
    report(value) {
      if (state.confirmed === value) return;
      set({ confirmed: value });
    },
    dispose() {
      clearTimer();
      listeners.clear();
    },
  };
}
