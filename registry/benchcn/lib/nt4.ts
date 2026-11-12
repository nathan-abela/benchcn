// benchcn.dev · nt4
// FIRST NetworkTables topics mapped onto benchcn channels, per the NetworkTables Protocol
// Specification, Version 4.1 (wpilibsuite/allwpilib, ntcore/doc/networktables4.adoc): JSON text
// frames for publish, subscribe and announce, MessagePack binary frames for values, and
// Cristian's-algorithm time sync on topic ID -1. Pure: the hook supplies the socket and the timer.
import { createMsgpackWriter, decodeMsgpackAll } from "@/registry/benchcn/lib/msgpack";
import {
  createConfirmations,
  helloFrom,
  isWireValue,
  type TopicChannel,
} from "@/registry/benchcn/lib/topic-source";
import { isCommand, type WireMessage, type WireValue } from "@/registry/benchcn/lib/wire";

/** Version 4.1 first, 4.0 as the fallback, as the spec asks. */
export const NT4_PROTOCOLS = ["v4.1.networktables.first.wpi.edu", "networktables.first.wpi.edu"];

/** Standard unsecure server port. */
export const NT4_PORT = 5810;

/** `ws://<host>:5810/nt/<name>`. The server appends `@n` to repeated names, so avoid `@` in `name`. */
export function nt4Url(host: string, name = "benchcn"): string {
  return `ws://${host}:${NT4_PORT}/nt/${encodeURIComponent(name)}`;
}

const TYPE_IDS: Record<string, number> = {
  boolean: 0,
  double: 1,
  int: 2,
  float: 3,
  string: 4,
  json: 4,
  raw: 5,
  rpc: 5,
  msgpack: 5,
  protobuf: 5,
  "boolean[]": 16,
  "double[]": 17,
  "int[]": 18,
  "float[]": 19,
  "string[]": 20,
};

/** Data type id for a type string. Types not in the spec's table travel as 5 (binary). */
export function nt4TypeId(type: string): number {
  return TYPE_IDS[type] ?? 5;
}

/** Types a command can publish. */
export type Nt4CommandType = "boolean" | "double" | "int" | "float" | "string";

export type Nt4Channel = TopicChannel & {
  /** Topic the value is read from: a sensor's reading, or the state that confirms a command. */
  topic?: string;
  /** For array topics (`double[]` and friends), the element this channel reads. */
  index?: number;
  /** Topic that `command(id, value)` publishes to, and the type to create it with. */
  command?: { topic: string; type: Nt4CommandType };
};

export type Nt4Channels = Record<string, Nt4Channel>;

export type Nt4Message = { method: string; params: Record<string, unknown> };

const METHODS = new Set([
  "publish",
  "unpublish",
  "setproperties",
  "subscribe",
  "unsubscribe",
  "announce",
  "unannounce",
  "properties",
]);

const isRecord = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x);

/** A text frame is a JSON array of messages; entries the spec says to ignore are dropped. */
export function parseNt4Text(text: string): Nt4Message[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (m): m is Nt4Message =>
      isRecord(m) && typeof m.method === "string" && METHODS.has(m.method) && isRecord(m.params),
  );
}

export function encodeNt4Text(messages: Nt4Message[]): string {
  return JSON.stringify(messages);
}

export type Nt4Value = { id: number; timestamp: number; type: number; value: unknown };

/** Every `[id, timestamp, type, value]` in a binary frame. Other shapes are ignored. */
export function decodeNt4Binary(bytes: Uint8Array): Nt4Value[] {
  let decoded: unknown[];
  try {
    decoded = decodeMsgpackAll(bytes);
  } catch {
    return [];
  }
  const values: Nt4Value[] = [];
  for (const item of decoded) {
    if (!Array.isArray(item) || item.length !== 4) continue;
    const [id, timestamp, type, value] = item;
    if (typeof id !== "number" || typeof timestamp !== "number" || typeof type !== "number")
      continue;
    values.push({ id, timestamp, type, value });
  }
  return values;
}

/** One `[id, timestamp, type, value]` message. `value` must match `type`. */
export function encodeNt4Value(
  id: number,
  timestamp: number,
  type: string,
  value: boolean | number | string,
): Uint8Array<ArrayBuffer> {
  const typeId = nt4TypeId(type);
  const writer = createMsgpackWriter().arrayHeader(4).int(id).int(timestamp).int(typeId);
  if (typeId === 0 && typeof value === "boolean") writer.bool(value);
  else if (typeId === 1 && typeof value === "number") writer.float64(value);
  else if (typeId === 2 && typeof value === "number") writer.int(value);
  else if (typeId === 3 && typeof value === "number") writer.float32(value);
  else if (typeId === 4 && typeof value === "string") writer.str(value);
  else throw new TypeError(`nt4: cannot send ${typeof value} as ${type}`);
  return writer.bytes();
}

/** Can `value` go out on a topic of `type` without changing it? */
export function fitsNt4Type(type: string, value: WireValue): boolean {
  if (type === "boolean") return typeof value === "boolean";
  if (type === "double" || type === "float") return typeof value === "number";
  if (type === "int") return typeof value === "number" && Number.isInteger(value);
  if (type === "string" || type === "json") return typeof value === "string";
  return false;
}

/** Cristian's algorithm over topic ID -1. All times in integer microseconds. */
export type Nt4Clock = {
  /** Record a server reply to a time request whose payload was `sentAt`. */
  reply(serverTime: number, sentAt: number, now: number): void;
  synced(): boolean;
  /** Server time equivalent to local `now`. */
  serverTime(now: number): number;
  /** Local time equivalent to a server timestamp. */
  localTime(serverTime: number): number;
  reset(): void;
};

export function createNt4Clock(): Nt4Clock {
  let offset: number | null = null;
  let bestRtt = Number.POSITIVE_INFINITY;
  return {
    reply(serverTime, sentAt, now) {
      const rtt = now - sentAt;
      if (rtt < 0 || rtt >= bestRtt) return;
      bestRtt = rtt;
      offset = serverTime + rtt / 2 - now;
    },
    synced: () => offset !== null,
    serverTime: (now) => Math.round(now + (offset ?? 0)),
    localTime: (serverTime) => serverTime - (offset ?? 0),
    reset() {
      offset = null;
      bestRtt = Number.POSITIVE_INFINITY;
    },
  };
}

/** Browsers cannot send WebSocket PINGs, so time requests double as the aliveness check. */
export const NT4_PING_INTERVAL = 1000;
export const NT4_PING_TIMEOUT = 3000;

const TIME_TOPIC = -1;
const SUBSCRIPTION = 1;

export type Nt4SessionOptions = {
  /** Seconds between value sweeps the server sends (`periodic`). Server default is 0.1. */
  periodic?: number;
  /** Wall clock in milliseconds. */
  now?: () => number;
};

export type Nt4Io = {
  sendText: (text: string) => void;
  sendBinary: (bytes: Uint8Array<ArrayBuffer>) => void;
  emit: (message: WireMessage) => void;
};

export type Nt4Session = {
  /** Call once the socket is open: announces the channels and measures the clock first. */
  open(): void;
  text(text: string): void;
  binary(bytes: Uint8Array): void;
  /** A wire message from the store. `set` commands become value updates; the rest is ignored. */
  send(message: WireMessage): void;
  /** Call every `NT4_PING_INTERVAL`. Returns `false` once the server has gone quiet too long. */
  tick(): boolean;
  /** Call before closing the socket on purpose: unsubscribes and unpublishes. */
  close(): void;
};

/** One session per connection: topic ids are connection-specific in NT4. */
export function createNt4Session(
  channels: Nt4Channels,
  { periodic, now = () => Date.now() }: Nt4SessionOptions,
  io: Nt4Io,
): Nt4Session {
  const entries = Object.entries(channels);
  const readTopics = [
    ...new Set(entries.flatMap(([, c]) => (c.topic === undefined ? [] : [c.topic]))),
  ];
  const publishers = new Map<string, { pubuid: number; type: string }>();
  for (const [, channel] of entries) {
    const target = channel.command;
    if (target && !publishers.has(target.topic)) {
      publishers.set(target.topic, { pubuid: publishers.size + 1, type: target.type });
    }
  }
  const announced = new Map<number, string>();
  const clock = createNt4Clock();
  const confirmations = createConfirmations((id) => channels[id]?.tolerance ?? 0);
  const micros = () => Math.round(now() * 1000);
  let lastReply = 0;
  let controlSent = false;

  const requestTime = () => {
    io.sendBinary(
      createMsgpackWriter().arrayHeader(4).int(TIME_TOPIC).int(0).int(2).int(micros()).bytes(),
    );
  };

  // The spec asks for the round trip to be measured before any control message, and forbids
  // publishing values until the clock is synchronised, so both wait for the first time reply.
  const sendControl = () => {
    controlSent = true;
    const messages: Nt4Message[] = [];
    for (const [name, { pubuid, type }] of publishers) {
      messages.push({ method: "publish", params: { name, pubuid, type, properties: {} } });
    }
    if (readTopics.length > 0) {
      messages.push({
        method: "subscribe",
        params: {
          topics: readTopics,
          subuid: SUBSCRIPTION,
          options: periodic === undefined ? {} : { periodic },
        },
      });
    }
    if (messages.length > 0) io.sendText(encodeNt4Text(messages));
  };

  const onValue = ({ id, timestamp, value }: Nt4Value) => {
    const name = announced.get(id);
    if (name === undefined) return;
    // Timestamp 0 is a default and 1 an offline set; neither is a time, so stamp on arrival.
    const t = timestamp > 1 && clock.synced() ? clock.localTime(timestamp) / 1e6 : undefined;
    for (const [channelId, channel] of entries) {
      if (channel.topic !== name) continue;
      let picked: unknown = value;
      if (channel.index !== undefined) {
        if (!Array.isArray(value)) continue;
        picked = value[channel.index];
      }
      if (!isWireValue(picked)) continue;
      const ack = confirmations.observe(channelId, picked);
      if (ack) io.emit(ack);
      io.emit({
        ch: channelId,
        v: picked,
        ...(t !== undefined && { t }),
        ...(channel.unit !== undefined && { u: channel.unit }),
      });
    }
  };

  return {
    open() {
      lastReply = now();
      io.emit(helloFrom("networktables", channels));
      requestTime();
    },
    text(text) {
      for (const { method, params } of parseNt4Text(text)) {
        if (method === "announce" && typeof params.id === "number") {
          if (typeof params.name === "string") announced.set(params.id, params.name);
          const publisher =
            typeof params.name === "string" ? publishers.get(params.name) : undefined;
          // The announced type is the one to publish with, whatever was asked for.
          if (publisher && params.pubuid === publisher.pubuid && typeof params.type === "string")
            publisher.type = params.type;
        } else if (method === "unannounce" && typeof params.id === "number") {
          announced.delete(params.id);
        }
      }
    },
    binary(bytes) {
      for (const message of decodeNt4Binary(bytes)) {
        if (message.id === TIME_TOPIC) {
          if (typeof message.value !== "number") continue;
          lastReply = now();
          clock.reply(message.timestamp, message.value, micros());
          if (!controlSent && clock.synced()) sendControl();
        } else {
          onValue(message);
        }
      }
    },
    send(message) {
      if (!isCommand(message) || message.cmd !== "set" || message.id === undefined) return;
      if (message.v === undefined) return;
      const id = message.id;
      const target = channels[id]?.command;
      const publisher = target ? publishers.get(target.topic) : undefined;
      if (!target || !publisher) {
        io.emit({ log: `nt4: no command topic for "${id}"`, lvl: "warn" });
        return;
      }
      if (!clock.synced()) {
        io.emit({ log: `nt4: "${id}" not sent, clock not synchronised yet`, lvl: "warn" });
        return;
      }
      if (!fitsNt4Type(publisher.type, message.v)) {
        io.emit({
          log: `nt4: "${id}" is ${publisher.type}, cannot send ${message.v}`,
          lvl: "warn",
        });
        return;
      }
      if (channels[id].topic !== undefined) confirmations.expect(id, message.n, message.v);
      io.sendBinary(
        encodeNt4Value(publisher.pubuid, clock.serverTime(micros()), publisher.type, message.v),
      );
    },
    tick() {
      if (now() - lastReply > NT4_PING_TIMEOUT) return false;
      requestTime();
      return true;
    },
    close() {
      if (controlSent) {
        const messages: Nt4Message[] = [...publishers.values()].map(({ pubuid }) => ({
          method: "unpublish",
          params: { pubuid },
        }));
        if (readTopics.length > 0)
          messages.push({ method: "unsubscribe", params: { subuid: SUBSCRIPTION } });
        if (messages.length > 0) io.sendText(encodeNt4Text(messages));
      }
      confirmations.clear();
      clock.reset();
    },
  };
}
