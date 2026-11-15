import type { WireChannelInfo } from "@/registry/benchcn/lib/wire";

import type { ChannelKind, PropLiteral, Span, Widget, WidgetType } from "./model";

/**
 * A bound prop as data, so the live preview and the generated code read the same description:
 * the preview evaluates it against the source, the generator prints it.
 */
export type Expr =
  | { op: "number"; id: string; fallback?: string }
  | { op: "sample"; id: string }
  | { op: "history"; id: string }
  | { op: "time"; id: string }
  | { op: "confirmedOn"; id: string }
  | { op: "state"; map: "actuators" | "setpoints"; id: string }
  | { op: "field"; map: "actuators" | "setpoints"; id: string; field: "confirmed" | "commanded" }
  | { op: "command"; id: string; param: string }
  | { op: "stream"; id: string }
  | { op: "series"; ids: string[] }
  | { op: "source" }
  | { op: "lines" }
  | { op: "sendLine" }
  | { op: "readout"; id: string; digits: number };

export type Attr = { name: string; expr: Expr } | { spread: Expr };

/** The title row a frame shows above an inline component whose label is for screen readers only. */
export type Header = { title: string; reading?: Expr; unit?: string };

export type Slot = {
  name: string;
  label: string;
  kind: ChannelKind;
  multiple?: boolean;
  optional?: boolean;
};

export type CatalogEntry = {
  type: WidgetType;
  title: string;
  group: "Readouts" | "Controls" | "Source";
  /** Export name of the component. */
  component: string;
  /** Inline components sit in an instrument frame so they hold a grid cell like the cards do. */
  inline?: boolean;
  span: Span;
  minSpan: Span;
  slots: Slot[];
  /** Channels a new widget would rather bind to, such as a battery voltage for a battery. */
  prefer?: (info: WireChannelInfo) => boolean;
  /** Props edited in the inspector, in the order they are written out. */
  editable: string[];
  /** Props a new widget starts with. */
  initial?: Record<string, PropLiteral>;
  /** Props taken from a channel's hello info when a slot is bound to it. */
  fromChannel?: (slot: string, info: WireChannelInfo) => Partial<Record<string, PropLiteral>>;
  attrs: (bind: (slot: string) => string | null, ids: (slot: string) => string[]) => Attr[];
  header?: (props: Widget["props"], bind: (slot: string) => string | null) => Header | null;
  /** Props the frame's title row shows instead of passing them to the component. */
  headerOnly?: string[];
};

/** Decimals for a reading shown beside a bar: whole numbers on wide ranges, more on narrow ones. */
function digitsFor(props: Widget["props"]): number {
  const min = typeof props.min === "number" ? props.min : 0;
  const max = typeof props.max === "number" ? props.max : 100;
  const span = Math.abs(max - min);
  return span >= 20 ? 0 : span >= 2 ? 1 : 2;
}

const range = (info: WireChannelInfo): Record<string, number> => ({
  ...(info.min === undefined ? {} : { min: info.min }),
  ...(info.max === undefined ? {} : { max: info.max }),
});

/** A step of about a hundredth of the range: 0.01 A on a 3 A limit, 0.1 V on 30 V, 1 on 0 to 100. */
const stepFor = (info: WireChannelInfo): Record<string, number> => {
  if (info.min === undefined || info.max === undefined || info.max <= info.min) return {};
  const step = 10 ** (Math.floor(Math.log10(info.max - info.min)) - 2);
  return step < 1 ? { step: Number(step.toPrecision(1)) } : {};
};

const labelled = (info: WireChannelInfo): Record<string, PropLiteral> => ({
  ...(info.label ? { label: info.label } : {}),
  ...(info.u ? { unit: info.u } : {}),
});

const ENTRIES: CatalogEntry[] = [
  {
    type: "sensor-tile",
    title: "Sensor tile",
    group: "Readouts",
    component: "SensorTile",
    span: 4,
    minSpan: 3,
    slots: [{ name: "value", label: "Reading", kind: "sensor" }],
    editable: ["label", "unit", "precision", "thresholds", "staleAfter"],
    initial: { label: "Reading" },
    fromChannel: (_, info) => ({
      ...labelled(info),
      ...(info.min === undefined && info.max === undefined ? {} : { thresholds: range(info) }),
    }),
    attrs: (bind) => {
      const id = bind("value");
      if (!id) return [];
      return [
        { name: "value", expr: { op: "number", id } },
        { name: "history", expr: { op: "history", id } },
        { name: "updatedAt", expr: { op: "time", id } },
      ];
    },
  },
  {
    type: "range-bar",
    title: "Range bar",
    group: "Readouts",
    component: "RangeBar",
    span: 6,
    minSpan: 4,
    slots: [
      { name: "value", label: "Reading", kind: "sensor" },
      { name: "setpoint", label: "Setpoint", kind: "setpoint", optional: true },
    ],
    editable: ["label", "unit", "min", "max", "precision", "thresholds", "orientation"],
    initial: { label: "Reading", min: 0, max: 100 },
    fromChannel: (slot, info) => (slot === "value" ? { ...labelled(info), ...range(info) } : {}),
    attrs: (bind) => {
      const id = bind("value");
      const setpoint = bind("setpoint");
      return [
        ...(id
          ? [
              { name: "value", expr: { op: "number", id } } as const,
              { name: "recent", expr: { op: "history", id } } as const,
            ]
          : []),
        ...(setpoint
          ? [
              {
                name: "setpoint",
                expr: { op: "field", map: "setpoints", id: setpoint, field: "confirmed" },
              } as const,
              {
                name: "commanded",
                expr: { op: "field", map: "setpoints", id: setpoint, field: "commanded" },
              } as const,
            ]
          : []),
      ];
    },
  },
  {
    type: "meter-readout",
    title: "Meter readout",
    group: "Readouts",
    component: "MeterReadout",
    span: 4,
    minSpan: 4,
    slots: [{ name: "value", label: "Reading", kind: "sensor" }],
    editable: ["label", "mode", "unit", "precision", "digits", "color"],
    initial: { label: "Meter" },
    fromChannel: (_, info) => labelled(info),
    attrs: (bind) => {
      const id = bind("value");
      if (!id) return [];
      return [
        { name: "value", expr: { op: "number", id } },
        { name: "sampleKey", expr: { op: "sample", id } },
      ];
    },
  },
  {
    type: "seven-segment",
    title: "Seven-segment display",
    group: "Readouts",
    component: "SevenSegment",
    inline: true,
    span: 4,
    minSpan: 3,
    slots: [{ name: "value", label: "Reading", kind: "sensor" }],
    editable: ["label", "digits", "decimals", "leadingZeros", "color", "size", "bezel"],
    initial: { digits: 5, decimals: 1 },
    fromChannel: (_, info) => (info.label ? { label: info.label } : {}),
    attrs: (bind) => {
      const id = bind("value");
      return id ? [{ name: "value", expr: { op: "number", id, fallback: "--" } }] : [];
    },
    // The component reads `label` to screen readers in place of the digits, so it is shown as
    // the card's title instead and the display keeps announcing its value.
    header: (props) =>
      typeof props.label === "string" && props.label !== "" ? { title: props.label } : null,
    headerOnly: ["label"],
  },
  {
    type: "led-bar",
    title: "LED bar",
    group: "Readouts",
    component: "LedBar",
    inline: true,
    span: 4,
    minSpan: 3,
    slots: [{ name: "value", label: "Reading", kind: "sensor" }],
    editable: [
      "label",
      "unit",
      "min",
      "max",
      "segments",
      "mode",
      "thresholds",
      "color",
      "orientation",
    ],
    initial: { label: "Level" },
    fromChannel: (_, info) => ({ ...labelled(info), ...range(info) }),
    attrs: (bind) => {
      const id = bind("value");
      return id ? [{ name: "value", expr: { op: "number", id } }] : [];
    },
    header: (props, bind) => {
      const id = bind("value");
      const title = typeof props.label === "string" ? props.label : "";
      const unit = typeof props.unit === "string" && props.unit !== "" ? props.unit : undefined;
      return {
        title,
        reading: id ? { op: "readout", id, digits: digitsFor(props) } : undefined,
        unit,
      };
    },
  },
  {
    type: "battery-indicator",
    prefer: (info) => /batt/i.test(`${info.id} ${info.label ?? ""}`),
    title: "Battery indicator",
    group: "Readouts",
    component: "BatteryIndicator",
    inline: true,
    span: 3,
    minSpan: 3,
    slots: [{ name: "value", label: "Reading", kind: "sensor" }],
    editable: ["label", "unit", "min", "max", "thresholds", "charging", "showValue"],
    fromChannel: (_, info) =>
      info.u === "V" ? { unit: "V", ...range(info) } : info.u === "%" ? { unit: "%" } : {},
    attrs: (bind) => {
      const id = bind("value");
      return id ? [{ name: "value", expr: { op: "number", id } }] : [];
    },
  },
  {
    type: "signal-strength",
    prefer: (info) => info.u === "dBm" || /rssi|signal/i.test(`${info.id} ${info.label ?? ""}`),
    title: "Signal strength",
    group: "Readouts",
    component: "SignalStrength",
    inline: true,
    span: 3,
    minSpan: 3,
    slots: [{ name: "value", label: "Reading", kind: "sensor" }],
    editable: ["label", "unit", "bars", "showValue"],
    fromChannel: (_, info) => (info.u === "dBm" || info.u === "%" ? { unit: info.u } : {}),
    attrs: (bind) => {
      const id = bind("value");
      return id ? [{ name: "value", expr: { op: "number", id } }] : [];
    },
  },
  {
    type: "strip-chart",
    title: "Strip chart",
    group: "Readouts",
    component: "StripChart",
    span: 8,
    minSpan: 6,
    slots: [{ name: "series", label: "Channels", kind: "sensor", multiple: true }],
    editable: ["title", "seconds", "min", "max", "layout", "staleAfter", "height"],
    attrs: (_, ids) => [{ name: "series", expr: { op: "series", ids: ids("series") } }],
  },
  {
    type: "status-led",
    title: "Status LED",
    group: "Readouts",
    component: "StatusLed",
    inline: true,
    span: 3,
    minSpan: 3,
    slots: [{ name: "on", label: "Actuator", kind: "actuator" }],
    editable: ["label", "color", "pattern", "rate", "size", "showLabel"],
    initial: { label: "Output", showLabel: true },
    fromChannel: (_, info) => (info.label ? { label: info.label } : {}),
    attrs: (bind) => {
      const id = bind("on");
      return id ? [{ name: "on", expr: { op: "confirmedOn", id } }] : [];
    },
  },
  {
    type: "actuator-control",
    title: "Actuator control",
    group: "Controls",
    component: "ActuatorControl",
    span: 4,
    minSpan: 4,
    slots: [{ name: "actuator", label: "Actuator", kind: "actuator" }],
    editable: ["label", "description", "holdMs", "disabled"],
    initial: { label: "Output" },
    fromChannel: (_, info) => (info.label ? { label: info.label } : {}),
    attrs: (bind) => control(bind("actuator"), "actuators", "next"),
  },
  {
    type: "momentary-button",
    title: "Momentary button",
    group: "Controls",
    component: "MomentaryButton",
    span: 4,
    minSpan: 4,
    slots: [{ name: "actuator", label: "Actuator", kind: "actuator" }],
    editable: ["label", "description", "action", "disabled"],
    initial: { label: "Output" },
    fromChannel: (_, info) => (info.label ? { label: info.label } : {}),
    attrs: (bind) => control(bind("actuator"), "actuators", "on"),
  },
  {
    type: "emergency-stop",
    title: "Emergency stop",
    group: "Controls",
    component: "EmergencyStop",
    span: 4,
    minSpan: 4,
    slots: [{ name: "actuator", label: "Actuator", kind: "actuator" }],
    editable: ["label", "description", "resetWindowMs"],
    attrs: (bind) => control(bind("actuator"), "actuators", "engaged"),
  },
  {
    type: "setpoint-input",
    title: "Setpoint input",
    group: "Controls",
    component: "SetpointInput",
    span: 6,
    minSpan: 4,
    slots: [
      { name: "setpoint", label: "Setpoint", kind: "setpoint" },
      { name: "value", label: "Measured", kind: "sensor", optional: true },
    ],
    editable: ["label", "description", "unit", "min", "max", "step", "precision", "disabled"],
    initial: { label: "Setpoint", min: 0, max: 100 },
    fromChannel: (slot, info) =>
      slot === "setpoint" ? { ...labelled(info), ...range(info), ...stepFor(info) } : {},
    attrs: (bind) => {
      const value = bind("value");
      return [
        ...(value ? [{ name: "value", expr: { op: "number", id: value } } as const] : []),
        ...control(bind("setpoint"), "setpoints", "next"),
      ];
    },
  },
  {
    type: "pwm-slider",
    title: "PWM slider",
    group: "Controls",
    component: "PwmSlider",
    span: 4,
    minSpan: 4,
    slots: [{ name: "setpoint", label: "Setpoint", kind: "setpoint" }],
    editable: ["label", "description", "unit", "min", "max", "step", "precision", "rate"],
    initial: { label: "Duty" },
    fromChannel: (_, info) => ({ ...labelled(info), ...range(info), ...stepFor(info) }),
    attrs: (bind) => {
      const id = bind("setpoint");
      if (!id) return [];
      return [
        { spread: { op: "state", map: "setpoints", id } },
        { name: "onChange", expr: { op: "stream", id } },
        { name: "onCommand", expr: { op: "command", id, param: "value" } },
      ];
    },
  },
  {
    type: "rotary-encoder",
    title: "Rotary encoder",
    group: "Controls",
    component: "RotaryEncoder",
    span: 4,
    minSpan: 4,
    slots: [{ name: "setpoint", label: "Setpoint", kind: "setpoint" }],
    editable: [
      "label",
      "description",
      "unit",
      "min",
      "max",
      "step",
      "precision",
      "wrap",
      "settleMs",
    ],
    initial: { label: "Setpoint", min: 0, max: 100 },
    fromChannel: (_, info) => ({ ...labelled(info), ...range(info), ...stepFor(info) }),
    attrs: (bind) => control(bind("setpoint"), "setpoints", "next"),
  },
  {
    type: "connection-status",
    title: "Connection status",
    group: "Source",
    component: "ConnectionStatus",
    inline: true,
    span: 3,
    minSpan: 3,
    slots: [],
    editable: ["label", "staleAfter"],
    attrs: () => [{ name: "source", expr: { op: "source" } }],
  },
  {
    type: "serial-console",
    title: "Serial console",
    group: "Source",
    component: "SerialConsole",
    span: 12,
    minSpan: 6,
    slots: [],
    editable: ["title", "status", "timestamps", "placeholder"],
    attrs: () => [
      { name: "lines", expr: { op: "lines" } },
      { name: "onCommand", expr: { op: "sendLine" } },
    ],
  },
];

function control(id: string | null, map: "actuators" | "setpoints", param: string): Attr[] {
  if (!id) return [];
  return [
    { spread: { op: "state", map, id } },
    { name: "onCommand", expr: { op: "command", id, param } },
  ];
}

export const CATALOG: Record<WidgetType, CatalogEntry> = Object.fromEntries(
  ENTRIES.map((entry) => [entry.type, entry]),
) as Record<WidgetType, CatalogEntry>;

export const CATALOG_ORDER: readonly WidgetType[] = ENTRIES.map((entry) => entry.type);

export function isWidgetType(value: unknown): value is WidgetType {
  return typeof value === "string" && value in CATALOG;
}

export function boundId(widget: Widget, slot: string): string | null {
  const value = widget.bind[slot];
  return typeof value === "string" && value !== "" ? value : null;
}

export function boundIds(widget: Widget, slot: string): string[] {
  const value = widget.bind[slot];
  if (Array.isArray(value)) return value.filter((id) => id !== "");
  return typeof value === "string" && value !== "" ? [value] : [];
}

export function widgetAttrs(widget: Widget): Attr[] {
  const entry = CATALOG[widget.type];
  return entry.attrs(
    (slot) => boundId(widget, slot),
    (slot) => boundIds(widget, slot),
  );
}

export function widgetHeader(widget: Widget): Header | null {
  return CATALOG[widget.type].header?.(widget.props, (slot) => boundId(widget, slot)) ?? null;
}

/** The channels a slot can bind to, from a source's hello. */
export function channelsFor(slot: Slot, channels: readonly WireChannelInfo[]): WireChannelInfo[] {
  return channels.filter((channel) => (channel.kind ?? "sensor") === slot.kind);
}
