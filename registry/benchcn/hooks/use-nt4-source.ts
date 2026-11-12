// benchcn.dev · use-nt4-source
// FIRST NetworkTables 4 as a benchcn source: subscribed topics become readings, `command`
// publishes, and a command is confirmed only when the robot reports it back on the state topic
// you name. Time sync doubles as the aliveness check. Same handle as the mock device.
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import {
  createReconnectingSocket,
  idleTransport,
  type SourceStatus,
  type StatusTransport,
  type WebSocketTransportOptions,
} from "@/registry/benchcn/hooks/use-websocket-source";
import {
  createNt4Session,
  NT4_PING_INTERVAL,
  NT4_PROTOCOLS,
  type Nt4Channels,
  type Nt4Session,
  type Nt4SessionOptions,
} from "@/registry/benchcn/lib/nt4";
import {
  createSourceStore,
  EMPTY_SNAPSHOT,
  type SourceSnapshot,
  type SourceStore,
  type SourceStoreOptions,
} from "@/registry/benchcn/lib/source-store";
import { idsOfKind } from "@/registry/benchcn/lib/topic-source";
import type { WireMessage } from "@/registry/benchcn/lib/wire";

export type Nt4TransportOptions = Omit<Nt4SessionOptions, "now"> &
  Omit<WebSocketTransportOptions, "protocols">;

export function createNt4Transport(
  url: string,
  channels: Nt4Channels,
  { periodic, reconnect, maxBackoff }: Nt4TransportOptions = {},
): StatusTransport {
  const listeners = new Set<(message: WireMessage) => void>();
  const emit = (message: WireMessage) => {
    for (const listener of listeners) listener(message);
  };
  let session: Nt4Session | null = null;
  let ticker: number | null = null;
  const stopTicker = () => {
    if (ticker !== null) window.clearInterval(ticker);
    ticker = null;
  };
  const socket = createReconnectingSocket(
    url,
    { protocols: NT4_PROTOCOLS, reconnect, maxBackoff },
    {
      onOpen(ws) {
        const current = createNt4Session(
          channels,
          { periodic },
          {
            sendText: (text) => ws.send(text),
            sendBinary: (bytes) => ws.send(bytes),
            emit,
          },
        );
        session = current;
        current.open();
        ticker = window.setInterval(() => {
          if (!current.tick()) socket.drop();
        }, NT4_PING_INTERVAL);
      },
      onMessage(data) {
        if (typeof data === "string") session?.text(data);
        else session?.binary(new Uint8Array(data));
      },
      onStop: () => session?.close(),
      onClose() {
        stopTicker();
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

export type UseNt4SourceOptions = Nt4TransportOptions &
  Omit<SourceStoreOptions, "actuators" | "setpoints"> & {
    /** Channel id to topic mapping. Read once, on mount. */
    channels: Nt4Channels;
  };

export type Nt4SourceHandle = SourceSnapshot & {
  status: SourceStatus;
  command: (id: string, value: boolean | number) => void;
  send: (message: WireMessage) => void;
  store: SourceStore;
};

/** `url` is `ws://<host>:5810/nt/<name>`; `nt4Url(host)` builds it. `null` stays disconnected. */
export function useNt4Source(url: string | null, options: UseNt4SourceOptions): Nt4SourceHandle {
  const [initial] = useState(options);
  const { transport, store } = useMemo(() => {
    const { channels, periodic, reconnect, maxBackoff, ...storeOptions } = initial;
    const t = url
      ? createNt4Transport(url, channels, { periodic, reconnect, maxBackoff })
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
