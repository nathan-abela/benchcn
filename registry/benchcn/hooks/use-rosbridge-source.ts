// benchcn.dev · use-rosbridge-source
// ROS 2 topics over a rosbridge WebSocket as a benchcn source: subscriptions become readings,
// `command` publishes, and a command is confirmed only when the robot reports it back on the
// state topic you name. Same handle as the mock device, so dashboards swap in one line.
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import {
  createReconnectingSocket,
  idleTransport,
  type SourceStatus,
  type StatusTransport,
  type WebSocketTransportOptions,
} from "@/registry/benchcn/hooks/use-websocket-source";
import {
  createRosbridgeSession,
  type RosbridgeChannels,
  type RosbridgeSession,
  type RosbridgeSessionOptions,
} from "@/registry/benchcn/lib/rosbridge";
import {
  createSourceStore,
  EMPTY_SNAPSHOT,
  type SourceSnapshot,
  type SourceStore,
  type SourceStoreOptions,
} from "@/registry/benchcn/lib/source-store";
import { idsOfKind } from "@/registry/benchcn/lib/topic-source";
import type { WireMessage } from "@/registry/benchcn/lib/wire";

export type RosbridgeTransportOptions = RosbridgeSessionOptions &
  Omit<WebSocketTransportOptions, "protocols">;

export function createRosbridgeTransport(
  url: string,
  channels: RosbridgeChannels,
  { throttleRate, reconnect, maxBackoff }: RosbridgeTransportOptions = {},
): StatusTransport {
  const listeners = new Set<(message: WireMessage) => void>();
  const emit = (message: WireMessage) => {
    for (const listener of listeners) listener(message);
  };
  let session: RosbridgeSession | null = null;
  const socket = createReconnectingSocket(
    url,
    { reconnect, maxBackoff },
    {
      onOpen(ws) {
        session = createRosbridgeSession(
          channels,
          { throttleRate },
          { send: (text) => ws.send(text), emit },
        );
        session.open();
      },
      onMessage(data) {
        // Binary frames only carry CBOR or PNG, which this source never asks for.
        if (typeof data === "string") session?.message(data);
      },
      onStop: () => session?.close(),
      onClose() {
        session = null;
      },
    },
  );

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    send(message) {
      session?.send(message);
    },
    start: socket.start,
    getStatus: socket.getStatus,
    subscribeStatus: socket.subscribeStatus,
    getAttempts: socket.getAttempts,
  };
}

export type UseRosbridgeSourceOptions = RosbridgeTransportOptions &
  Omit<SourceStoreOptions, "actuators" | "setpoints"> & {
    /** Channel id to topic mapping. Read once, on mount. */
    channels: RosbridgeChannels;
  };

export type RosbridgeSourceHandle = SourceSnapshot & {
  status: SourceStatus;
  command: (id: string, value: boolean | number) => void;
  send: (message: WireMessage) => void;
  store: SourceStore;
};

/** Pass `null` as the URL to stay disconnected, for example until the user enters one. */
export function useRosbridgeSource(
  url: string | null,
  options: UseRosbridgeSourceOptions,
): RosbridgeSourceHandle {
  const [initial] = useState(options);
  const { transport, store } = useMemo(() => {
    const { channels, throttleRate, reconnect, maxBackoff, ...storeOptions } = initial;
    const t = url
      ? createRosbridgeTransport(url, channels, { throttleRate, reconnect, maxBackoff })
      : idleTransport();
    const s = createSourceStore(t, {
      ...storeOptions,
      actuators: idsOfKind(channels, "actuator"),
      setpoints: idsOfKind(channels, "setpoint"),
    });
    return { transport: t, store: s };
  }, [url, initial]);

  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, () => EMPTY_SNAPSHOT);
  const status = useSyncExternalStore(
    transport.subscribeStatus,
    transport.getStatus,
    () => "idle" as const,
  );

  useEffect(() => store.start(), [store]);

  return useMemo(
    () => ({ ...snapshot, status, command: store.command, send: store.send, store }),
    [snapshot, status, store],
  );
}
