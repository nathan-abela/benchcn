// benchcn.dev · topic-source
// Shared by sources that map a robot's own topics onto benchcn channels (rosbridge, NetworkTables):
// the channel description, the hello it implies, and confirmation that only a state report earns.
import {
  type WireAck,
  type WireChannelInfo,
  type WireHello,
  type WireValue,
  WIRE_VERSION,
} from "@/registry/benchcn/lib/wire";

export type TopicChannelKind = "sensor" | "digital" | "actuator" | "setpoint";

/** What a topic-backed channel is, independent of the protocol carrying it. */
export type TopicChannel = {
  /** Defaults to `"sensor"`. Actuators and setpoints are tracked from the moment the source starts. */
  kind?: TopicChannelKind;
  unit?: string;
  min?: number;
  max?: number;
  label?: string;
  /** A reported number this close to the commanded one confirms it. */
  tolerance?: number;
};

export function kindOf(channel: TopicChannel): TopicChannelKind {
  return channel.kind ?? "sensor";
}

export function idsOfKind(
  channels: Record<string, TopicChannel>,
  kind: TopicChannelKind,
): string[] {
  return Object.keys(channels).filter((id) => kindOf(channels[id]) === kind);
}

/** The channel list as a wire `hello`, so components that read units and ranges from it work. */
export function helloFrom(dev: string, channels: Record<string, TopicChannel>): WireHello {
  const chs: WireChannelInfo[] = Object.entries(channels).map(([id, channel]) => {
    const info: WireChannelInfo = { id, kind: kindOf(channel) };
    if (channel.unit !== undefined) info.u = channel.unit;
    if (channel.min !== undefined) info.min = channel.min;
    if (channel.max !== undefined) info.max = channel.max;
    if (channel.label !== undefined) info.label = channel.label;
    return info;
  });
  return { hello: WIRE_VERSION, dev, chs };
}

/** Float topics round on the way through; this keeps a float32 round trip from looking like a mismatch. */
const RELATIVE_EPSILON = 1e-6;

export function sameValue(commanded: WireValue, reported: WireValue, tolerance = 0): boolean {
  if (typeof commanded === "number" && typeof reported === "number") {
    return (
      Math.abs(commanded - reported) <= Math.max(tolerance, Math.abs(commanded) * RELATIVE_EPSILON)
    );
  }
  return commanded === reported;
}

export type Confirmations = {
  /** A command went out with this nonce and is waiting for the robot to report it. */
  expect(id: string, nonce: number, value: WireValue): void;
  /** A value the robot reported for `id`. Returns the acknowledgement it earns, if any. */
  observe(id: string, value: WireValue): WireAck | null;
  clear(): void;
};

/**
 * Neither rosbridge nor NetworkTables acknowledges a publish, so the only honest confirmation is
 * the robot reporting the commanded value back on a state topic. A report that does not match
 * leaves the command pending, and the actuator tracker times it out.
 */
export function createConfirmations(tolerance: (id: string) => number = () => 0): Confirmations {
  const pending = new Map<string, { nonce: number; value: WireValue }>();
  return {
    expect(id, nonce, value) {
      pending.set(id, { nonce, value });
    },
    observe(id, value) {
      const waiting = pending.get(id);
      if (!waiting || !sameValue(waiting.value, value, tolerance(id))) return null;
      pending.delete(id);
      return { ack: waiting.nonce, ok: true, id, v: value };
    },
    clear() {
      pending.clear();
    },
  };
}

export const isWireValue = (x: unknown): x is WireValue =>
  (typeof x === "number" && Number.isFinite(x)) || typeof x === "boolean" || typeof x === "string";
