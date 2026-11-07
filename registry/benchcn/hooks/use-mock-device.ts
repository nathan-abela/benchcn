// benchcn.dev · use-mock-device
// Binds the mock device to React through the shared source store: live readings, histories,
// logs, tracked actuators and a `command` helper. Swap it for a real source when hardware exists.
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import {
  createMockDevice,
  type MockDevice,
  type MockDeviceOptions,
} from "@/registry/benchcn/lib/mock-device";
import {
  createSourceStore,
  EMPTY_SNAPSHOT,
  type SourceSnapshot,
  type SourceStore,
  type SourceStoreOptions,
} from "@/registry/benchcn/lib/source-store";
import type { WireMessage } from "@/registry/benchcn/lib/wire";

export type UseMockDeviceOptions = MockDeviceOptions & Omit<SourceStoreOptions, "actuators">;

export type MockDeviceHandle = SourceSnapshot & {
  device: MockDevice;
  command: (id: string, value: boolean) => void;
  send: (message: WireMessage) => void;
  store: SourceStore;
};

function createMockStore(options: UseMockDeviceOptions): {
  device: MockDevice;
  store: SourceStore;
} {
  const { actuatorTimeout, failSafe, logLimit, historyLength, ...deviceOptions } = options;
  const device = createMockDevice(deviceOptions);
  const store = createSourceStore(
    {
      subscribe: device.subscribe,
      send: device.send,
      start() {
        device.start();
        return () => device.stop();
      },
    },
    {
      actuatorTimeout,
      failSafe,
      logLimit,
      historyLength,
      actuators: device.channels.filter((c) => c.kind === "actuator").map((c) => c.id),
    },
  );
  return { device, store };
}

export function useMockDevice(options: UseMockDeviceOptions = {}): MockDeviceHandle {
  const [{ device, store }] = useState(() => createMockStore(options));
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, () => EMPTY_SNAPSHOT);

  useEffect(() => store.start(), [store]);

  return useMemo(
    () => ({ ...snapshot, device, command: store.command, send: store.send, store }),
    [snapshot, device, store],
  );
}
