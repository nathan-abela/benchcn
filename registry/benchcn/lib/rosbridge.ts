// benchcn.dev · rosbridge
// ROS 2 topics mapped onto benchcn channels over the rosbridge protocol, v2.1.0
// (RobotWebTools/rosbridge_suite, ROSBRIDGE_PROTOCOL.md): JSON `subscribe`, `advertise`,
// `publish`, `unsubscribe` and `unadvertise` ops. Pure: the hook supplies the socket.
import {
  createConfirmations,
  helloFrom,
  isWireValue,
  type TopicChannel,
} from "@/registry/benchcn/lib/topic-source";
import { isCommand, type WireMessage, type WireValue } from "@/registry/benchcn/lib/wire";

/** A dot path into the message (`"linear.x"`, `"pose.pose.position.x"`) or a function of it. */
export type RosbridgeField = string | ((msg: unknown) => unknown);

export type RosbridgeChannel = TopicChannel & {
  /** Topic the value is read from: a sensor's reading, or the state that confirms a command. */
  topic?: string;
  /**
   * Interface type of `topic`, such as `std_msgs/msg/Float64`. Without it rosbridge infers the type,
   * and the subscription fails if the topic does not exist yet.
   */
  type?: string;
  /** Where the value sits in a `topic` message. Defaults to `"data"`, as in `std_msgs`. */
  field?: RosbridgeField;
  /** Topic that `command(id, value)` publishes to. */
  command?: {
    topic: string;
    /** Required: `advertise` needs the interface type. */
    type: string;
    /** Dot path the value is written to. Defaults to `"data"`. */
    field?: string;
  };
};

export type RosbridgeChannels = Record<string, RosbridgeChannel>;

export type RosbridgeOp = { op: string } & Record<string, unknown>;

const ID_PREFIX = "benchcn:";

export function subscribeOp(
  topic: string,
  { type, throttleRate }: { type?: string; throttleRate?: number } = {},
): RosbridgeOp {
  const op: RosbridgeOp = { op: "subscribe", id: ID_PREFIX + topic, topic };
  if (type !== undefined) op.type = type;
  if (throttleRate !== undefined && throttleRate > 0) op.throttle_rate = Math.round(throttleRate);
  return op;
}

export function unsubscribeOp(topic: string): RosbridgeOp {
  return { op: "unsubscribe", id: ID_PREFIX + topic, topic };
}

export function advertiseOp(topic: string, type: string): RosbridgeOp {
  return { op: "advertise", id: ID_PREFIX + topic, topic, type };
}

export function unadvertiseOp(topic: string): RosbridgeOp {
  return { op: "unadvertise", id: ID_PREFIX + topic, topic };
}

export function publishOp(topic: string, msg: Record<string, unknown>): RosbridgeOp {
  return { op: "publish", topic, msg };
}

const isRecord = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x);

/** Any JSON object with a string `op` is a rosbridge message; anything else is ignored. */
export function parseRosbridge(text: string): RosbridgeOp | null {
  try {
    const parsed: unknown = JSON.parse(text);
    return isRecord(parsed) && typeof parsed.op === "string" ? (parsed as RosbridgeOp) : null;
  } catch {
    return null;
  }
}

export function readField(msg: unknown, field: RosbridgeField = "data"): unknown {
  if (typeof field === "function") return field(msg);
  let current: unknown = msg;
  for (const key of field.split(".")) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/** Returns a copy of `msg` with `value` at `path`, creating objects along the way. */
export function writeField(
  msg: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> {
  const [key, ...rest] = path.split(".");
  if (rest.length === 0) return { ...msg, [key]: value };
  const child = isRecord(msg[key]) ? msg[key] : {};
  return { ...msg, [key]: writeField(child, rest.join("."), value) };
}

/** Yaw from a `geometry_msgs/msg/Quaternion`, in degrees counterclockwise from +x. */
export function quaternionToHeading(q: unknown): number | undefined {
  if (!isRecord(q)) return undefined;
  const { x, y, z, w } = q;
  if (![x, y, z, w].every((n) => typeof n === "number")) return undefined;
  const [qx, qy, qz, qw] = [x, y, z, w] as number[];
  const yaw = Math.atan2(2 * (qw * qz + qx * qy), 1 - 2 * (qy * qy + qz * qz));
  return (yaw * 180) / Math.PI;
}

export type RosbridgeSessionOptions = {
  /** Minimum milliseconds between messages per subscribed topic (`throttle_rate`). */
  throttleRate?: number;
};

export type RosbridgeIo = {
  send: (text: string) => void;
  emit: (message: WireMessage) => void;
};

export type RosbridgeSession = {
  /** Call once the socket is open: announces the channels, subscribes and advertises. */
  open(): void;
  /** One text frame from the server. */
  message(text: string): void;
  /** A wire message from the store. `set` commands become publishes; the rest is ignored. */
  send(message: WireMessage): void;
  /** Call before closing the socket on purpose: unsubscribes and unadvertises. */
  close(): void;
};

/** One session per connection: `rosbridge_server` drops subscriptions and adverts with the socket. */
export function createRosbridgeSession(
  channels: RosbridgeChannels,
  { throttleRate }: RosbridgeSessionOptions,
  io: RosbridgeIo,
): RosbridgeSession {
  const entries = Object.entries(channels);
  const readTopics = new Map<string, string | undefined>();
  const commandTopics = new Map<string, string>();
  for (const [, channel] of entries) {
    if (channel.topic !== undefined) {
      readTopics.set(channel.topic, readTopics.get(channel.topic) ?? channel.type);
    }
    if (channel.command) commandTopics.set(channel.command.topic, channel.command.type);
  }
  // Channels that share a command topic, such as `linear.x` and `angular.z` of one `Twist`,
  // publish the whole message each time so one field does not reset the other to zero.
  const outgoing = new Map<string, Record<string, unknown>>();
  const confirmations = createConfirmations((id) => channels[id]?.tolerance ?? 0);
  const write = (op: RosbridgeOp) => io.send(JSON.stringify(op));

  return {
    open() {
      io.emit(helloFrom("rosbridge", channels));
      for (const [topic, type] of readTopics) write(subscribeOp(topic, { type, throttleRate }));
      for (const [topic, type] of commandTopics) write(advertiseOp(topic, type));
    },
    message(text) {
      const op = parseRosbridge(text);
      if (!op || op.op !== "publish" || typeof op.topic !== "string") return;
      for (const [id, channel] of entries) {
        if (channel.topic !== op.topic) continue;
        const value = readField(op.msg, channel.field);
        if (!isWireValue(value)) continue;
        const ack = confirmations.observe(id, value);
        if (ack) io.emit(ack);
        io.emit({ ch: id, v: value, ...(channel.unit !== undefined && { u: channel.unit }) });
      }
    },
    send(message) {
      if (!isCommand(message) || message.cmd !== "set" || message.id === undefined) return;
      if (message.v === undefined) return;
      const id = message.id;
      const target = channels[id]?.command;
      if (!target) {
        io.emit({ log: `rosbridge: no command topic for "${id}"`, lvl: "warn" });
        return;
      }
      const value: WireValue = message.v;
      const msg = writeField(outgoing.get(target.topic) ?? {}, target.field ?? "data", value);
      outgoing.set(target.topic, msg);
      if (channels[id].topic !== undefined) confirmations.expect(id, message.n, value);
      write(publishOp(target.topic, msg));
    },
    close() {
      for (const topic of readTopics.keys()) write(unsubscribeOp(topic));
      for (const topic of commandTopics.keys()) write(unadvertiseOp(topic));
      confirmations.clear();
    },
  };
}
