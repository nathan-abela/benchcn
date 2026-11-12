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

export type ReconnectingSocketHandlers = {
  /** A connection opened. `socket` stays valid until `onClose`. */
  onOpen?: (socket: WebSocket) => void;
  onMessage: (data: string | ArrayBuffer) => void;
  /** The connection closed, on purpose or not. */
  onClose?: () => void;
  /** Runs while the socket is still open when `start`'s cleanup closes it on purpose. */
  onStop?: (socket: WebSocket) => void;
};

export type ReconnectingSocket = {
  /** Opens the socket. Returns a function that closes it for good. */
  start: () => () => void;
  /** Sends on the open socket; returns `false` when there is none. */
  send: (data: Parameters<WebSocket["send"]>[0]) => boolean;
  /** Closes the current connection; with `reconnect` on, a new one follows after the backoff. */
  drop: () => void;
  getStatus: () => SourceStatus;
  subscribeStatus: (listener: () => void) => () => void;
  getAttempts: () => number;
};

/** The connection lifecycle every WebSocket source shares: status, backoff and reconnect. */
export function createReconnectingSocket(
  url: string,
  { protocols, reconnect = true, maxBackoff = 10_000 }: WebSocketTransportOptions,
  handlers: ReconnectingSocketHandlers,
): ReconnectingSocket {
  const statusListeners = new Set<() => void>();
  let socket: WebSocket | null = null;
  let status: SourceStatus = "idle";
  let attempts = 0;
  let timer: number | null = null;
  let stopped = true;

  const setStatus = (next: SourceStatus) => {
    status = next;
    for (const listener of statusListeners) listener();
  };

  const open = () => {
    if (stopped) return;
    attempts += 1;
    setStatus("connecting");
    const current = new WebSocket(url, protocols);
    socket = current;
    current.binaryType = "arraybuffer";
    // Events from a socket that has since been replaced (a restart, a drop) are ignored.
    current.onopen = () => {
      if (socket !== current) return;
      attempts = 0;
      setStatus("open");
      handlers.onOpen?.(current);
    };
    current.onmessage = (event: MessageEvent<string | ArrayBuffer>) => {
      if (socket === current) handlers.onMessage(event.data);
    };
    current.onerror = () => {
      if (socket === current) setStatus("error");
    };
    current.onclose = () => {
      if (socket !== current) return;
      socket = null;
      handlers.onClose?.();
      setStatus("closed");
      if (!stopped && reconnect) {
        const wait = Math.min(maxBackoff, 500 * 2 ** Math.min(attempts, 6));
        timer = window.setTimeout(open, wait);
      }
    };
  };

  return {
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
        const current = socket;
        socket = null;
        if (current) {
          if (current.readyState === WebSocket.OPEN) handlers.onStop?.(current);
          current.close();
          handlers.onClose?.();
        }
        setStatus("closed");
      };
    },
    send(data) {
      if (socket?.readyState !== WebSocket.OPEN) return false;
      socket.send(data);
      return true;
    },
    drop() {
      socket?.close();
    },
    getStatus: () => status,
    subscribeStatus(listener) {
      statusListeners.add(listener);
      return () => statusListeners.delete(listener);
    },
    getAttempts: () => attempts,
  };
}

export function createWebSocketTransport(
  url: string,
  options: WebSocketTransportOptions = {},
): StatusTransport {
  const listeners = new Set<(message: WireMessage) => void>();
  const parser = createLineParser((message) => {
    for (const listener of listeners) listener(message);
  });
  const socket = createReconnectingSocket(url, options, {
    onMessage(data) {
      const text = typeof data === "string" ? data : new TextDecoder().decode(data);
      parser.push(text.endsWith("\n") ? text : `${text}\n`);
    },
  });

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    send(message) {
      socket.send(encodeMessage(message));
    },
    start() {
      const stop = socket.start();
      return () => {
        stop();
        parser.end();
      };
    },
    getStatus: socket.getStatus,
    subscribeStatus: socket.subscribeStatus,
    getAttempts: socket.getAttempts,
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

/** A transport that never connects, for a source with no URL yet. */
export function idleTransport(): StatusTransport {
  return {
    subscribe: () => () => {},
    send: () => {},
    start: () => () => {},
    getStatus: () => "idle",
    subscribeStatus: () => () => {},
    getAttempts: () => 0,
  };
}
