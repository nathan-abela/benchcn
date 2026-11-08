// benchcn.dev · use-websocket-source
// A WebSocket that speaks the wire protocol: newline-delimited JSON in, commands out, reconnect
// with backoff, and the same snapshot shape as the mock device so dashboards swap in one line.
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import {
  createSourceStore,
  EMPTY_SNAPSHOT,
  type SourceSnapshot,
  type SourceStore,
  type SourceStoreOptions,
  type Transport,
} from "@/registry/benchcn/lib/source-store";
import { createLineParser, encodeMessage, type WireMessage } from "@/registry/benchcn/lib/wire";

export type SourceStatus = "idle" | "connecting" | "open" | "closed" | "error" | "unsupported";

export type WebSocketTransportOptions = {
  protocols?: string | string[];
  /** Reconnect after a drop, with exponential backoff. */
  reconnect?: boolean;
  /** Longest wait between attempts, in milliseconds. */
  maxBackoff?: number;
};

export type StatusTransport = Transport & {
  getStatus: () => SourceStatus;
  subscribeStatus: (listener: () => void) => () => void;
  /** Number of connection attempts since start. */
  getAttempts: () => number;
};

export function createWebSocketTransport(
  url: string,
  { protocols, reconnect = true, maxBackoff = 10_000 }: WebSocketTransportOptions = {},
): StatusTransport {
  const listeners = new Set<(message: WireMessage) => void>();
  const statusListeners = new Set<() => void>();
  let socket: WebSocket | null = null;
  let status: SourceStatus = "idle";
  let attempts = 0;
  let timer: number | null = null;
  let stopped = true;
  const parser = createLineParser((message) => {
    for (const listener of listeners) listener(message);
  });

  const setStatus = (next: SourceStatus) => {
    status = next;
    for (const listener of statusListeners) listener();
  };

  const open = () => {
    if (stopped) return;
    attempts += 1;
    setStatus("connecting");
    socket = new WebSocket(url, protocols);
    socket.binaryType = "arraybuffer";
    socket.onopen = () => {
      attempts = 0;
      setStatus("open");
    };
    socket.onmessage = (event: MessageEvent<string | ArrayBuffer>) => {
      const data = event.data;
      const text = typeof data === "string" ? data : new TextDecoder().decode(data);
      parser.push(text.endsWith("\n") ? text : `${text}\n`);
    };
    socket.onerror = () => setStatus("error");
    socket.onclose = () => {
      socket = null;
      if (stopped) {
        setStatus("closed");
        return;
      }
      setStatus("closed");
      if (reconnect) {
        const wait = Math.min(maxBackoff, 500 * 2 ** Math.min(attempts, 6));
        timer = window.setTimeout(open, wait);
      }
    };
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    send(message) {
      if (socket?.readyState === WebSocket.OPEN) socket.send(encodeMessage(message));
    },
    start() {
      stopped = false;
      if (typeof WebSocket === "undefined") {
        setStatus("unsupported");
        return () => {};
      }
      open();
      return () => {
        stopped = true;
        if (timer !== null) window.clearTimeout(timer);
        timer = null;
        socket?.close();
        socket = null;
        parser.end();
      };
    },
    getStatus: () => status,
    subscribeStatus(listener) {
      statusListeners.add(listener);
      return () => statusListeners.delete(listener);
    },
    getAttempts: () => attempts,
  };
}

export type UseWebSocketSourceOptions = WebSocketTransportOptions &
  Omit<SourceStoreOptions, "actuators" | "setpoints">;

export type WebSocketSourceHandle = SourceSnapshot & {
  status: SourceStatus;
  command: (id: string, value: boolean | number) => void;
  send: (message: WireMessage) => void;
  store: SourceStore;
};

/** Pass `null` as the URL to stay disconnected, for example until the user enters one. */
export function useWebSocketSource(
  url: string | null,
  options: UseWebSocketSourceOptions = {},
): WebSocketSourceHandle {
  const [initial] = useState(options);
  const { transport, store } = useMemo(() => {
    const { protocols, reconnect, maxBackoff, ...storeOptions } = initial;
    const t = url
      ? createWebSocketTransport(url, { protocols, reconnect, maxBackoff })
      : idleTransport();
    return { transport: t, store: createSourceStore(t, storeOptions) };
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

function idleTransport(): StatusTransport {
  return {
    subscribe: () => () => {},
    send: () => {},
    start: () => () => {},
    getStatus: () => "idle",
    subscribeStatus: () => () => {},
    getAttempts: () => 0,
  };
}
