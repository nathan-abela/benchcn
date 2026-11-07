// benchcn.dev · use-mock-device
// Binds the mock device to React: live readings, logs and tracked actuators, plus a `command`
// helper that sends a `set` and follows its acknowledgement.
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import {
  type ActuatorState,
  type ActuatorTracker,
  createActuatorTracker,
  INITIAL_ACTUATOR_STATE,
} from "@/registry/benchcn/lib/actuator";
import {
  createMockDevice,
  type MockDevice,
  type MockDeviceOptions,
} from "@/registry/benchcn/lib/mock-device";
import {
  isAck,
  isLog,
  isSample,
  nextNonce,
  setCommand,
  type WireCommand,
  type WireLog,
  type WireSample,
} from "@/registry/benchcn/lib/wire";

export type UseMockDeviceOptions = MockDeviceOptions & {
  /** Milliseconds to wait for an acknowledgement before an actuator reports a timeout. */
  actuatorTimeout?: number;
  /** Per-actuator fail-safe state assumed after a timeout. */
  failSafe?: Record<string, boolean>;
  /** How many log lines to keep. */
  logLimit?: number;
};

export type MockDeviceSnapshot = {
  readings: Record<string, WireSample>;
  logs: WireLog[];
  actuators: Record<string, ActuatorState>;
};

export type MockDeviceHandle = MockDeviceSnapshot & {
  device: MockDevice;
  /** Sends `{"cmd":"set"}` for an actuator and tracks the acknowledgement. */
  command: (id: string, value: boolean) => void;
  send: (command: WireCommand) => void;
};

const EMPTY: MockDeviceSnapshot = { readings: {}, logs: [], actuators: {} };

type Store = {
  device: MockDevice;
  getSnapshot: () => MockDeviceSnapshot;
  subscribe: (listener: () => void) => () => void;
  command: (id: string, value: boolean) => void;
  start: () => () => void;
};

function createStore(options: UseMockDeviceOptions): Store {
  const { actuatorTimeout = 2000, failSafe = {}, logLimit = 200, ...deviceOptions } = options;
  const device = createMockDevice(deviceOptions);
  const trackers = new Map<string, ActuatorTracker>();
  const queries = new Map<number, string>();
  const listeners = new Set<() => void>();
  let snapshot: MockDeviceSnapshot = EMPTY;

  const notify = () => {
    for (const listener of listeners) listener();
  };

  const trackerFor = (id: string) => {
    let tracker = trackers.get(id);
    if (!tracker) {
      tracker = createActuatorTracker({ timeout: actuatorTimeout, failSafe: failSafe[id] ?? null });
      tracker.subscribe((state) => {
        snapshot = { ...snapshot, actuators: { ...snapshot.actuators, [id]: state } };
        notify();
      });
      snapshot = {
        ...snapshot,
        actuators: { ...snapshot.actuators, [id]: tracker.get() ?? INITIAL_ACTUATOR_STATE },
      };
      trackers.set(id, tracker);
    }
    return tracker;
  };

  for (const channel of device.channels) {
    if (channel.kind === "actuator") trackerFor(channel.id);
  }

  return {
    device,
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    command(id, value) {
      const message = setCommand(id, value);
      trackerFor(id).command(value, message.n);
      device.send(message);
    },
    start() {
      const unsubscribe = device.subscribe((message) => {
        if (isSample(message)) {
          snapshot = { ...snapshot, readings: { ...snapshot.readings, [message.ch]: message } };
          notify();
        } else if (isLog(message)) {
          snapshot = { ...snapshot, logs: [...snapshot.logs, message].slice(-logLimit) };
          notify();
        } else if (isAck(message)) {
          const queried = queries.get(message.ack);
          if (queried !== undefined) {
            queries.delete(message.ack);
            if (message.ok && typeof message.v === "boolean") trackerFor(queried).report(message.v);
          }
          for (const tracker of trackers.values()) tracker.ack(message);
        }
      });
      device.start();
      for (const id of trackers.keys()) {
        const n = nextNonce();
        queries.set(n, id);
        device.send({ cmd: "get", n, id });
      }
      return () => {
        unsubscribe();
        device.stop();
      };
    },
  };
}

export function useMockDevice(options: UseMockDeviceOptions = {}): MockDeviceHandle {
  const [store] = useState(() => createStore(options));
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, () => EMPTY);

  useEffect(() => store.start(), [store]);

  return useMemo(
    () => ({
      ...snapshot,
      device: store.device,
      command: store.command,
      send: store.device.send,
    }),
    [snapshot, store],
  );
}
