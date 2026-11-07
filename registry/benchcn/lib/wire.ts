// benchcn.dev · wire
// benchcn wire protocol v0: newline-delimited JSON between a device and a dashboard.
// Spec: https://benchcn.dev/docs/wire-protocol

export const WIRE_VERSION = "benchcn/0";

export type WireValue = number | boolean | string;

/** One reading on a channel. `t` is seconds since the Unix epoch; omitted means "now". */
export type WireSample = {
  ch: string;
  v: WireValue;
  u?: string;
  t?: number;
};

/** A block of evenly spaced numeric samples, for scopes and logic analyzers. */
export type WireBlock = {
  ch: string;
  vs: number[];
  sr: number;
  u?: string;
  t?: number;
};

export type WireCommandVerb = "set" | "get" | "ping";

/** Dashboard to device. `n` is a nonce the device echoes back in its ack. */
export type WireCommand = {
  cmd: WireCommandVerb;
  n: number;
  id?: string;
  v?: WireValue;
  t?: number;
};

/** Device to dashboard, in reply to a command. */
export type WireAck = {
  ack: number;
  ok: boolean;
  id?: string;
  v?: WireValue;
  err?: string;
  t?: number;
};

export type WireLogLevel = "debug" | "info" | "warn" | "error";

export type WireLog = {
  log: string;
  lvl?: WireLogLevel;
  t?: number;
};

export type WireChannelInfo = {
  id: string;
  u?: string;
  min?: number;
  max?: number;
  kind?: "sensor" | "actuator" | "waveform" | "digital";
  label?: string;
};

/** First line a device sends: protocol version, a device name and its channels. */
export type WireHello = {
  hello: string;
  dev?: string;
  chs?: WireChannelInfo[];
  t?: number;
};

export type WireMessage = WireSample | WireBlock | WireCommand | WireAck | WireLog | WireHello;

export const isSample = (m: WireMessage): m is WireSample => "ch" in m && "v" in m;
export const isBlock = (m: WireMessage): m is WireBlock => "ch" in m && "vs" in m;
export const isCommand = (m: WireMessage): m is WireCommand => "cmd" in m;
export const isAck = (m: WireMessage): m is WireAck => "ack" in m;
export const isLog = (m: WireMessage): m is WireLog => "log" in m;
export const isHello = (m: WireMessage): m is WireHello => "hello" in m;

const isRecord = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x);

const isValue = (x: unknown): x is WireValue =>
  typeof x === "number" || typeof x === "boolean" || typeof x === "string";

function shapeOf(o: Record<string, unknown>): WireMessage | null {
  if (typeof o.ch === "string") {
    if (Array.isArray(o.vs) && typeof o.sr === "number") {
      return o.vs.every((v) => typeof v === "number") ? (o as WireBlock) : null;
    }
    return isValue(o.v) ? (o as WireSample) : null;
  }
  if (typeof o.cmd === "string" && typeof o.n === "number") return o as WireCommand;
  if (typeof o.ack === "number" && typeof o.ok === "boolean") return o as WireAck;
  if (typeof o.log === "string") return o as WireLog;
  if (typeof o.hello === "string") return o as WireHello;
  return null;
}

/**
 * Parses one line. Anything that is not a valid JSON object in a known shape is returned as a
 * log line, so plain `print()` output from firmware still shows up in a serial console.
 */
export function parseLine(line: string): WireMessage | null {
  const text = line.replace(/\r$/, "");
  if (text.trim() === "") return null;
  if (text[0] === "{") {
    try {
      const parsed: unknown = JSON.parse(text);
      if (isRecord(parsed)) {
        const shaped = shapeOf(parsed);
        if (shaped) return shaped;
      }
    } catch {
      // not JSON: fall through and treat the line as text
    }
  }
  return { log: text, lvl: "info" };
}

export function encodeMessage(message: WireMessage): string {
  return `${JSON.stringify(message)}\n`;
}

/**
 * Splits a byte or text stream into lines, tolerating chunk boundaries anywhere.
 * Feed it whatever the transport delivers; it calls `onMessage` once per complete line.
 */
export type LineParser = {
  push(chunk: string | Uint8Array): void;
  end(): void;
};

export function createLineParser(onMessage: (message: WireMessage) => void): LineParser {
  let pending = "";
  const decoder = new TextDecoder();

  const flushLines = () => {
    let index = pending.indexOf("\n");
    while (index !== -1) {
      const message = parseLine(pending.slice(0, index));
      pending = pending.slice(index + 1);
      if (message) onMessage(message);
      index = pending.indexOf("\n");
    }
  };

  return {
    push(chunk: string | Uint8Array) {
      pending += typeof chunk === "string" ? chunk : decoder.decode(chunk, { stream: true });
      flushLines();
    },
    /** Emits a trailing line that never got its newline (call on disconnect). */
    end() {
      if (pending.length > 0) {
        const message = parseLine(pending);
        pending = "";
        if (message) onMessage(message);
      }
    },
  };
}

let nonce = 0;

export function nextNonce(): number {
  nonce = (nonce + 1) % 0x7fffffff;
  return nonce;
}

export function setCommand(id: string, v: WireValue): WireCommand {
  return { cmd: "set", n: nextNonce(), id, v };
}

/**
 * Normalises a wire timestamp to milliseconds since the Unix epoch.
 * Devices without a clock send seconds since boot; anything below one billion is treated as
 * such and anchored to the receiver's clock at the time the first message arrived.
 */
export function createClockMapper(
  now: () => number = () => Date.now(),
): (t: number | undefined) => number {
  let bootOffsetMs: number | null = null;
  return (t: number | undefined): number => {
    if (t === undefined) return now();
    if (t >= 1e9) return t * 1000;
    if (bootOffsetMs === null) bootOffsetMs = now() - t * 1000;
    return bootOffsetMs + t * 1000;
  };
}
