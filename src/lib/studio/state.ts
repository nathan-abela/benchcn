import type { WireChannelInfo } from "@/registry/benchcn/lib/wire";

import { CATALOG, channelsFor, isWidgetType } from "./catalog";
import { acceptsValue, controlsFor } from "./controls";
import {
  isSpan,
  type PropLiteral,
  type SourceConfig,
  type StudioState,
  type Widget,
  type WidgetType,
  widgetId,
} from "./model";

/** Channel ids end up in generated code as string literals, so they stay short and plain. */
export const CHANNEL_ID = /^[\w.:/-]{1,32}$/;

const PLACEHOLDER: Record<string, string> = {
  sensor: "reading",
  actuator: "output",
  setpoint: "setpoint",
};

export const DEFAULT_STATE: StudioState = {
  v: 1,
  source: { kind: "mock" },
  widgets: [
    {
      id: "temp",
      type: "sensor-tile",
      span: 4,
      bind: { value: "temp" },
      props: {
        label: "Air temperature",
        unit: "°C",
        thresholds: { min: 0, max: 40, warnBelow: 10, warnAbove: 28, low: 2, high: 35 },
      },
    },
    {
      id: "humidity",
      type: "sensor-tile",
      span: 4,
      bind: { value: "humidity" },
      props: {
        label: "Humidity",
        unit: "%",
        precision: 0,
        thresholds: { min: 0, max: 100, warnBelow: 30, warnAbove: 70 },
      },
    },
    {
      id: "soil",
      type: "sensor-tile",
      span: 4,
      bind: { value: "soil" },
      props: {
        label: "Soil moisture",
        unit: "%",
        precision: 0,
        thresholds: { min: 0, max: 100, low: 20, warnBelow: 30, warnAbove: 80 },
      },
    },
    {
      id: "trend",
      type: "strip-chart",
      span: 8,
      bind: { series: ["soil", "humidity"] },
      props: { title: "Soil and humidity", height: 160 },
    },
    {
      id: "pump",
      type: "actuator-control",
      span: 4,
      bind: { actuator: "pump" },
      props: { label: "Water pump", description: "Relay on GPIO 17" },
    },
    {
      id: "heater",
      type: "setpoint-input",
      span: 6,
      bind: { setpoint: "heater", value: "chamber" },
      props: { label: "Heater setpoint", unit: "°C", min: 15, max: 35, step: 0.5 },
    },
    {
      id: "chamber",
      type: "range-bar",
      span: 6,
      bind: { value: "chamber", setpoint: "heater" },
      props: {
        label: "Chamber temperature",
        unit: "°C",
        min: 0,
        max: 50,
        thresholds: { warnAbove: 38, high: 45 },
      },
    },
  ],
};

/** A new widget of a type, bound to the first matching channel not already on the canvas. */
export function createWidget(
  type: WidgetType,
  channels: readonly WireChannelInfo[],
  existing: readonly Widget[],
): Widget {
  const entry = CATALOG[type];
  const used = new Set(
    existing.flatMap((w) => Object.values(w.bind).flatMap((v) => (v === null ? [] : v))),
  );
  let widget: Widget = {
    id: widgetId(),
    type,
    span: entry.span,
    bind: {},
    props: { ...entry.initial },
  };
  for (const slot of entry.slots) {
    if (slot.optional) {
      widget = { ...widget, bind: { ...widget.bind, [slot.name]: null } };
      continue;
    }
    const options = channelsFor(slot, channels);
    const preferred = entry.prefer ? options.filter(entry.prefer) : [];
    const pick = preferred[0] ?? options.find((c) => !used.has(c.id)) ?? options[0];
    if (slot.multiple) {
      widget = { ...widget, bind: { ...widget.bind, [slot.name]: pick ? [pick.id] : [] } };
    } else {
      widget = bindSlot(widget, slot.name, pick?.id ?? PLACEHOLDER[slot.kind], pick);
    }
  }
  return widget;
}

/** Binds a slot and takes the label, unit and range the channel reports. */
export function bindSlot(
  widget: Widget,
  slot: string,
  value: string | string[] | null,
  info?: WireChannelInfo,
): Widget {
  const entry = CATALOG[widget.type];
  const taken = info && entry.fromChannel ? entry.fromChannel(slot, info) : {};
  const fromChannel = Object.fromEntries(
    Object.entries(taken).filter((pair): pair is [string, PropLiteral] => pair[1] !== undefined),
  );
  return {
    ...widget,
    bind: { ...widget.bind, [slot]: value },
    props: { ...widget.props, ...fromChannel },
  };
}

export function setProp(widget: Widget, name: string, value: PropLiteral | undefined): Widget {
  const props = { ...widget.props };
  if (value === undefined) delete props[name];
  else props[name] = value;
  return { ...widget, props };
}

function readSource(value: unknown): SourceConfig {
  if (typeof value === "object" && value !== null && "kind" in value) {
    const source = value as { kind: unknown; url?: unknown };
    if (source.kind === "websocket") {
      const url = typeof source.url === "string" ? source.url.slice(0, 300) : "";
      return { kind: "websocket", url };
    }
  }
  return { kind: "mock" };
}

function readWidget(value: unknown, index: number): Widget | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;
  if (!isWidgetType(raw.type)) return null;
  const entry = CATALOG[raw.type];
  const rawBind = (typeof raw.bind === "object" && raw.bind !== null ? raw.bind : {}) as Record<
    string,
    unknown
  >;
  const bind: Widget["bind"] = {};
  for (const slot of entry.slots) {
    const v = rawBind[slot.name];
    if (slot.multiple) {
      bind[slot.name] = Array.isArray(v)
        ? v.filter((id): id is string => typeof id === "string" && CHANNEL_ID.test(id)).slice(0, 8)
        : [];
    } else if (typeof v === "string" && CHANNEL_ID.test(v)) {
      bind[slot.name] = v;
    } else if (slot.optional) {
      bind[slot.name] = null;
    } else {
      return null;
    }
  }
  const rawProps = (typeof raw.props === "object" && raw.props !== null ? raw.props : {}) as Record<
    string,
    unknown
  >;
  const props: Widget["props"] = {};
  for (const control of controlsFor(raw.type, entry.editable)) {
    const v = rawProps[control.name];
    if (acceptsValue(control, v)) props[control.name] = v;
  }
  for (const [name, v] of Object.entries(entry.initial ?? {})) {
    if (!(name in props)) props[name] = v;
  }
  const span = isSpan(raw.span) && raw.span >= entry.minSpan ? raw.span : entry.span;
  const id = typeof raw.id === "string" && /^\w{1,40}$/.test(raw.id) ? raw.id : `w${index}`;
  return { id, type: raw.type, span, bind, props };
}

/** Reads a layout from untrusted JSON: a shared link or a stored draft. */
export function readState(value: unknown): StudioState | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;
  if (raw.v !== 1 || !Array.isArray(raw.widgets)) return null;
  const widgets = raw.widgets
    .slice(0, 60)
    .map(readWidget)
    .filter((w): w is Widget => w !== null);
  const seen = new Set<string>();
  return {
    v: 1,
    source: readSource(raw.source),
    widgets: widgets.map((w, i) => {
      const id = seen.has(w.id) ? `${w.id}_${i}` : w.id;
      seen.add(id);
      return { ...w, id };
    }),
  };
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  const base64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function pipe(bytes: Uint8Array, stream: GenericTransformStream): Promise<Uint8Array> {
  const piped = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(piped).arrayBuffer());
}

/** Compresses a layout into the text after `#s=`. */
export async function encodeState(state: StudioState): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(state));
  return toBase64Url(await pipe(json, new CompressionStream("deflate-raw")));
}

export async function decodeState(text: string): Promise<StudioState | null> {
  try {
    const bytes = await pipe(fromBase64Url(text), new DecompressionStream("deflate-raw"));
    return readState(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return null;
  }
}

export const SHARE_PREFIX = "#s=";
