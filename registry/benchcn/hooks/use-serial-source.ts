// benchcn.dev · use-serial-source
// Web Serial as a wire-protocol source. Chromium only, and the port picker must open from a
// click, so `connect` is something you call from a button rather than on mount.
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";

import type { SourceStatus } from "@/registry/benchcn/hooks/use-websocket-source";
import {
  createSourceStore,
  EMPTY_SNAPSHOT,
  type SourceSnapshot,
  type SourceStore,
  type SourceStoreOptions,
  type Transport,
} from "@/registry/benchcn/lib/source-store";
import { createLineParser, encodeMessage, type WireMessage } from "@/registry/benchcn/lib/wire";

type SerialPortLike = {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream<BufferSource> | null;
  writable: WritableStream<Uint8Array> | null;
};

type SerialLike = {
  requestPort(options?: {
    filters?: { usbVendorId?: number; usbProductId?: number }[];
  }): Promise<SerialPortLike>;
};

function serialApi(): SerialLike | null {
  if (typeof navigator === "undefined") return null;
  const nav = navigator as Navigator & { serial?: SerialLike };
  return nav.serial ?? null;
}

export type SerialTransportOptions = {
  baudRate?: number;
  filters?: { usbVendorId?: number; usbProductId?: number }[];
};

export type SerialTransport = Transport & {
  getStatus: () => SourceStatus;
  subscribeStatus: (listener: () => void) => () => void;
  /** Opens the browser's port picker. Must run inside a user gesture. */
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
};

export function createSerialTransport({
  baudRate = 115_200,
  filters,
}: SerialTransportOptions = {}): SerialTransport {
  const listeners = new Set<(message: WireMessage) => void>();
  const statusListeners = new Set<() => void>();
  let status: SourceStatus = serialApi() ? "idle" : "unsupported";
  let port: SerialPortLike | null = null;
  let reader: ReadableStreamDefaultReader<string> | null = null;
  let writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  const parser = createLineParser((message) => {
    for (const listener of listeners) listener(message);
  });

  const setStatus = (next: SourceStatus) => {
    status = next;
    for (const listener of statusListeners) listener();
  };

  const pump = async (stream: ReadableStream<BufferSource>) => {
    const current = stream.pipeThrough(new TextDecoderStream()).getReader();
    reader = current;
    const readNext = (): Promise<void> =>
      current.read().then(({ value, done }) => {
        if (done) return;
        if (value) parser.push(value);
        return readNext();
      });
    try {
      await readNext();
    } catch {
      setStatus("error");
    } finally {
      current.releaseLock();
      reader = null;
    }
  };

  const disconnect = async () => {
    try {
      await reader?.cancel();
      writer?.releaseLock();
      writer = null;
      await port?.close();
    } catch {
      // The port may already be gone; closing is best effort.
    }
    port = null;
    parser.end();
    setStatus("closed");
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    send(message) {
      if (!writer) return;
      void writer.write(new TextEncoder().encode(encodeMessage(message)));
    },
    start: () => () => {
      void disconnect();
    },
    getStatus: () => status,
    subscribeStatus(listener) {
      statusListeners.add(listener);
      return () => statusListeners.delete(listener);
    },
    async connect() {
      const api = serialApi();
      if (!api) {
        setStatus("unsupported");
        return;
      }
      try {
        setStatus("connecting");
        port = await api.requestPort(filters ? { filters } : undefined);
        await port.open({ baudRate });
        writer = port.writable?.getWriter() ?? null;
        setStatus("open");
        if (port.readable) void pump(port.readable).then(() => setStatus("closed"));
      } catch {
        setStatus(port ? "error" : "idle");
      }
    },
    disconnect,
  };
}

export type UseSerialSourceOptions = SerialTransportOptions &
  Omit<SourceStoreOptions, "actuators" | "setpoints">;

export type SerialSourceHandle = SourceSnapshot & {
  status: SourceStatus;
  /** Call from a click handler. */
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  command: (id: string, value: boolean | number) => void;
  send: (message: WireMessage) => void;
  store: SourceStore;
};

export function useSerialSource(options: UseSerialSourceOptions = {}): SerialSourceHandle {
  const [{ transport, store }] = useState(() => {
    const { baudRate, filters, ...storeOptions } = options;
    const t = createSerialTransport({ baudRate, filters });
    return { transport: t, store: createSourceStore(t, storeOptions) };
  });

  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, () => EMPTY_SNAPSHOT);
  const status = useSyncExternalStore(
    transport.subscribeStatus,
    transport.getStatus,
    () => "idle" as const,
  );

  useEffect(() => store.start(), [store]);

  const connect = useCallback(() => transport.connect(), [transport]);
  const disconnect = useCallback(() => transport.disconnect(), [transport]);

  return useMemo(
    () => ({
      ...snapshot,
      status,
      connect,
      disconnect,
      command: store.command,
      send: store.send,
      store,
    }),
    [snapshot, status, connect, disconnect, store],
  );
}
