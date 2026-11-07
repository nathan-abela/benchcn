// benchcn.dev · actuator
// Tracks one actuator through the command/acknowledge round trip so the UI can tell what was
// asked for apart from what the device confirmed. Pure, with an injectable clock for tests.
export type ActuatorState = {
  /** What the user last asked for. */
  commanded: boolean | null;
  /** What the device last reported. `null` until the first acknowledgement or report. */
  confirmed: boolean | null;
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

export type ActuatorTrackerOptions = {
  /** Milliseconds to wait for an acknowledgement. */
  timeout?: number;
  /** State the device falls back to on its own when it loses the link; shown after a timeout. */
  failSafe?: boolean | null;
  now?: () => number;
  setTimeout?: (fn: () => void, ms: number) => unknown;
  clearTimeout?: (handle: unknown) => void;
};

export type ActuatorTracker = {
  get(): ActuatorState;
  subscribe(listener: (state: ActuatorState) => void): () => void;
  /** Records a request that went out with this nonce and starts the timeout. */
  command(value: boolean, nonce: number): void;
  /** Feed every acknowledgement; those for other nonces are ignored. */
  ack(ack: ActuatorAck): void;
  /** State the device reported outside an acknowledgement, such as a telemetry sample. */
  report(value: boolean): void;
  dispose(): void;
};

export const INITIAL_ACTUATOR_STATE: ActuatorState = {
  commanded: null,
  confirmed: null,
  pending: false,
  error: null,
  latency: null,
  updatedAt: 0,
};

export function createActuatorTracker(options: ActuatorTrackerOptions = {}): ActuatorTracker {
  const {
    timeout = 2000,
    failSafe = null,
    now = () => Date.now(),
    setTimeout: schedule = (fn, ms) => globalThis.setTimeout(fn, ms),
    clearTimeout: cancel = (handle) => globalThis.clearTimeout(handle as number),
  } = options;

  let state = INITIAL_ACTUATOR_STATE;
  let nonce: number | null = null;
  let sentAt = 0;
  let timer: unknown = null;
  const listeners = new Set<(state: ActuatorState) => void>();

  const set = (patch: Partial<ActuatorState>) => {
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
          confirmed: typeof ack.v === "boolean" ? ack.v : state.commanded,
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
