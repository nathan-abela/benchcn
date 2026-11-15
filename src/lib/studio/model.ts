export type ChannelKind = "sensor" | "actuator" | "setpoint";

export type Span = 3 | 4 | 6 | 8 | 12;

export const SPANS: readonly Span[] = [3, 4, 6, 8, 12];

export type PropLiteral = string | number | boolean | Record<string, number>;

export type WidgetType =
  | "sensor-tile"
  | "range-bar"
  | "meter-readout"
  | "seven-segment"
  | "led-bar"
  | "battery-indicator"
  | "signal-strength"
  | "strip-chart"
  | "status-led"
  | "actuator-control"
  | "momentary-button"
  | "emergency-stop"
  | "setpoint-input"
  | "pwm-slider"
  | "rotary-encoder"
  | "connection-status"
  | "serial-console";

export type Widget = {
  id: string;
  type: WidgetType;
  span: Span;
  /** Slot name to a channel id, a list of ids for multi-channel slots, or null when unbound. */
  bind: Record<string, string | string[] | null>;
  /** Only props that differ from the component's defaults, plus required ones. */
  props: Record<string, PropLiteral>;
};

export type SourceConfig = { kind: "mock" } | { kind: "websocket"; url: string };

export type StudioState = {
  v: 1;
  source: SourceConfig;
  widgets: Widget[];
};

export const DEFAULT_WEBSOCKET_URL = "ws://localhost:8080";

export function isSpan(value: unknown): value is Span {
  return SPANS.includes(value as Span);
}

/** Moves the item at `from` so it ends up at `to`, clamped to the list. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (from < 0 || from >= items.length) return [...items];
  const target = Math.max(0, Math.min(items.length - 1, to));
  if (target === from) return [...items];
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(target, 0, item);
  return next;
}

/** The next span up or down, never below `min`. */
export function stepSpan(span: Span, direction: 1 | -1, min: Span = 3): Span {
  const allowed = SPANS.filter((s) => s >= min);
  const index = allowed.indexOf(span);
  if (index === -1) return allowed[0];
  return allowed[Math.max(0, Math.min(allowed.length - 1, index + direction))];
}

/**
 * Where a dragged item lands among the other items' rectangles: before the first item whose
 * middle the pointer has not passed, reading row by row.
 */
export function dropIndex(
  pointer: { x: number; y: number },
  rects: readonly { left: number; top: number; width: number; height: number }[],
): number {
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (pointer.y < r.top) return i;
    const inRow = pointer.y <= r.top + r.height;
    if (inRow && pointer.x < r.left + r.width / 2) return i;
  }
  return rects.length;
}

let counter = 0;

export function widgetId(): string {
  counter += 1;
  return `w${Date.now().toString(36)}${counter.toString(36)}`;
}
