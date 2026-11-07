// benchcn.dev · source-store
// Turns any transport that speaks the wire protocol into one snapshot React can subscribe to:
// latest readings, short histories, logs, and actuators tracked through their acknowledgements.
import {
  type ActuatorState,
  type ActuatorTracker,
  createActuatorTracker,
} from "@/registry/benchcn/lib/actuator";
import {
  isAck,
  isBlock,
  isHello,
  isLog,
  isSample,
  nextNonce,
  setCommand,
  type WireBlock,
  type WireHello,
  type WireLog,
  type WireMessage,
  type WireSample,
} from "@/registry/benchcn/lib/wire";

export type Transport = {
  subscribe(listener: (message: WireMessage) => void): () => void;
  send(message: WireMessage): void;
  /** Opens the transport. Returns a function that closes it. */
  start(): () => void;
};

export type SourceSnapshot = {
  readings: Record<string, WireSample>;
  /** Recent numeric values per channel, oldest first. */
  history: Record<string, number[]>;
  logs: WireLog[];
  actuators: Record<string, ActuatorState>;
  hello: WireHello | null;
  /** Counts every message, so consumers can tell a quiet link from a dead one. */
  received: number;
};

export type SourceStoreOptions = {
  /** Milliseconds to wait for an acknowledgement before an actuator reports a timeout. */
  actuatorTimeout?: number;
  /** Per-actuator fail-safe state assumed after a timeout. */
  failSafe?: Record<string, boolean>;
  logLimit?: number;
  historyLength?: number;
  /** Actuator ids to track before the device says hello. */
  actuators?: string[];
};

export type SourceStore = {
  getSnapshot: () => SourceSnapshot;
  subscribe: (listener: () => void) => () => void;
  /** Sends `{"cmd":"set"}` for an actuator and follows its acknowledgement. */
  command: (id: string, value: boolean) => void;
  send: (message: WireMessage) => void;
  /** Subscribes to the transport and opens it. Returns a function that closes it. */
  start: () => () => void;
  /** Raw blocks, for ring buffers. */
  onBlock: (listener: (block: WireBlock) => void) => () => void;
};

/** What every source hook returns, and what blocks accept as `source`. */
export type SourceHandle = SourceSnapshot & {
  command: (id: string, value: boolean) => void;
  send: (message: WireMessage) => void;
  store: SourceStore;
};

export const EMPTY_SNAPSHOT: SourceSnapshot = {
  readings: {},
  history: {},
  logs: [],
  actuators: {},
  hello: null,
  received: 0,
};

export function createSourceStore(
  transport: Transport,
  options: SourceStoreOptions = {},
): SourceStore {
  const {
    actuatorTimeout = 2000,
    failSafe = {},
    logLimit = 200,
    historyLength = 60,
    actuators = [],
  } = options;

  const trackers = new Map<string, ActuatorTracker>();
  const queries = new Map<number, string>();
  const listeners = new Set<() => void>();
  const blockListeners = new Set<(block: WireBlock) => void>();
  let snapshot: SourceSnapshot = EMPTY_SNAPSHOT;

  const notify = () => {
    for (const listener of listeners) listener();
  };

  const trackerFor = (id: string): ActuatorTracker => {
    let tracker = trackers.get(id);
    if (!tracker) {
      tracker = createActuatorTracker({ timeout: actuatorTimeout, failSafe: failSafe[id] ?? null });
      tracker.subscribe((state) => {
        snapshot = { ...snapshot, actuators: { ...snapshot.actuators, [id]: state } };
        notify();
      });
      snapshot = { ...snapshot, actuators: { ...snapshot.actuators, [id]: tracker.get() } };
      trackers.set(id, tracker);
    }
    return tracker;
  };

  const query = (id: string) => {
    const n = nextNonce();
    queries.set(n, id);
    transport.send({ cmd: "get", n, id });
  };

  for (const id of actuators) trackerFor(id);

  const onMessage = (message: WireMessage) => {
    snapshot = { ...snapshot, received: snapshot.received + 1 };
    if (isSample(message)) {
      const history =
        typeof message.v === "number"
          ? {
              ...snapshot.history,
              [message.ch]: [...(snapshot.history[message.ch] ?? []), message.v].slice(
                -historyLength,
              ),
            }
          : snapshot.history;
      snapshot = {
        ...snapshot,
        readings: { ...snapshot.readings, [message.ch]: message },
        history,
      };
      const tracker = trackers.get(message.ch);
      if (tracker && typeof message.v === "boolean") tracker.report(message.v);
    } else if (isLog(message)) {
      snapshot = { ...snapshot, logs: [...snapshot.logs, message].slice(-logLimit) };
    } else if (isAck(message)) {
      const queried = queries.get(message.ack);
      if (queried !== undefined) {
        queries.delete(message.ack);
        if (message.ok && typeof message.v === "boolean") trackerFor(queried).report(message.v);
      }
      for (const tracker of trackers.values()) tracker.ack(message);
    } else if (isHello(message)) {
      snapshot = { ...snapshot, hello: message };
      for (const channel of message.chs ?? []) {
        if (channel.kind === "actuator") {
          trackerFor(channel.id);
          query(channel.id);
        }
      }
    } else if (isBlock(message)) {
      for (const listener of blockListeners) listener(message);
    }
    notify();
  };

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    command(id, value) {
      const message = setCommand(id, value);
      trackerFor(id).command(value, message.n);
      transport.send(message);
    },
    send: (message) => transport.send(message),
    start() {
      const unsubscribe = transport.subscribe(onMessage);
      const stop = transport.start();
      for (const id of actuators) query(id);
      return () => {
        unsubscribe();
        stop();
        for (const tracker of trackers.values()) tracker.dispose();
      };
    },
    onBlock(listener) {
      blockListeners.add(listener);
      return () => blockListeners.delete(listener);
    },
  };
}
