// benchcn.dev · oscilloscope
// A working oscilloscope: edge trigger with hysteresis, 1-2-5 timebase and volts per division,
// phosphor persistence, time and voltage cursors, and live measurements. Canvas 2D, drawn at
// device pixel ratio.
import {
  type ComponentProps,
  createContext,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type ReactNode,
  use,
  useCallback,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { cn } from "@/lib/utils";
import { type CanvasFrame, useCanvas } from "@/registry/benchcn/hooks/use-canvas";
import {
  channelToken,
  INSTRUMENT_FRAME,
  InstrumentLabel,
  Readout as ReadoutCell,
  resolveCssColor,
  useReducedMotion,
} from "@/registry/benchcn/lib/instrument";
import {
  captureWindow,
  type CursorAxis,
  type CursorPair,
  type CursorReadout,
  measure,
  type Measurements,
  moveCursor,
  readCursors,
  type TriggerEdge,
} from "@/registry/benchcn/lib/scope-math";
import { formatSi } from "@/registry/benchcn/lib/units";

export type ScopeData = ArrayLike<number> | (() => ArrayLike<number>);

export type ScopeChannel = {
  id: string;
  label?: string;
  /** Any CSS colour. Defaults to `--channel-n` from @benchcn/tokens, then `--chart-n`. */
  color?: string;
  unit?: string;
  /** Samples, newest last. Pass a function to let the scope pull fresh samples every frame. */
  data: ScopeData;
  sampleRate: number;
  voltsPerDiv?: number;
  /** Vertical position of zero, in divisions from the centre line. */
  offset?: number;
  visible?: boolean;
};

export type ScopeTrigger = {
  /** Channel id. Defaults to the first channel. */
  source?: string;
  level?: number;
  edge?: TriggerEdge;
  /** Auto sweeps freely without a trigger; normal holds the last triggered capture. */
  mode?: "auto" | "normal";
  /** Fraction of the screen before the trigger point. */
  pretrigger?: number;
};

export type ScopeSnapshot = {
  triggered: boolean;
  measurements: Record<string, Measurements>;
};

export type ScopeRootProps = ComponentProps<"div"> & {
  channels: ScopeChannel[];
  /** Seconds per division. */
  timebase?: number;
  trigger?: ScopeTrigger;
  /** 0 clears every frame; values up to 1 leave fading trails. */
  persistence?: number;
  running?: boolean;
  divisions?: { x: number; y: number };
  /** Shows a pair of cursors, A and B, to drag or step with the arrow keys. */
  cursors?: CursorAxis | "off";
  onTriggerLevelChange?: (level: number) => void;
};

type ResolvedTrigger = Required<ScopeTrigger>;

type SnapshotStore = {
  get: () => ScopeSnapshot;
  subscribe: (listener: () => void) => () => void;
  publish: (next: ScopeSnapshot, time: number) => void;
};

type ScopeContextValue = {
  channels: ScopeChannel[];
  timebase: number;
  trigger: ResolvedTrigger;
  persistence: number;
  running: boolean;
  divisions: { x: number; y: number };
  cursors: CursorAxis | "off";
  cursorPositions: Record<CursorAxis, CursorPair>;
  setCursor: (axis: CursorAxis, index: 0 | 1, position: number) => void;
  store: SnapshotStore;
  onTriggerLevelChange?: (level: number) => void;
};

const ScopeContext = createContext<ScopeContextValue | null>(null);

const EMPTY_SNAPSHOT: ScopeSnapshot = { triggered: false, measurements: {} };
const PUBLISH_INTERVAL = 100;
const DEFAULT_DIVISIONS = { x: 10, y: 8 };
const SCREEN_FALLBACK = "oklch(0.17 0.004 80)";
const DEFAULT_CURSORS: Record<CursorAxis, CursorPair> = { time: [-2, 2], voltage: [-1, 1] };
const CURSOR_NAMES = ["A", "B"] as const;
const CURSOR_STEP = 0.1;

function useScope(): ScopeContextValue {
  const context = use(ScopeContext);
  if (!context) throw new Error("Scope parts must be rendered inside <Scope.Root>.");
  return context;
}

function createSnapshotStore(): SnapshotStore {
  let snapshot = EMPTY_SNAPSHOT;
  let lastPublish = 0;
  const listeners = new Set<() => void>();
  return {
    get: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    publish(next, time) {
      if (time - lastPublish < PUBLISH_INTERVAL) return;
      lastPublish = time;
      snapshot = next;
      for (const listener of listeners) listener();
    },
  };
}

function getSamples(channel: ScopeChannel): ArrayLike<number> {
  return typeof channel.data === "function" ? channel.data() : channel.data;
}

function channelColor(channel: ScopeChannel, index: number): string {
  return channel.color ?? channelToken(index + 1);
}

function Root({
  channels,
  timebase = 0.0002,
  trigger,
  persistence = 0.5,
  running = true,
  divisions = DEFAULT_DIVISIONS,
  cursors = "off",
  onTriggerLevelChange,
  className,
  ...props
}: ScopeRootProps): ReactElement {
  const store = useMemo(() => createSnapshotStore(), []);
  const [cursorPositions, setCursorPositions] = useState(DEFAULT_CURSORS);
  const setCursor = useCallback(
    (axis: CursorAxis, index: 0 | 1, position: number) =>
      setCursorPositions((current) => ({
        ...current,
        [axis]: moveCursor(
          current[axis],
          index,
          position,
          axis === "time" ? divisions.x : divisions.y,
        ),
      })),
    [divisions],
  );
  const resolvedTrigger = useMemo<ResolvedTrigger>(
    () => ({
      source: trigger?.source ?? channels[0]?.id ?? "",
      level: trigger?.level ?? 0,
      edge: trigger?.edge ?? "rising",
      mode: trigger?.mode ?? "auto",
      pretrigger: trigger?.pretrigger ?? 0.5,
    }),
    [trigger, channels],
  );
  const value = useMemo<ScopeContextValue>(
    () => ({
      channels,
      timebase,
      trigger: resolvedTrigger,
      persistence,
      running,
      divisions,
      cursors,
      cursorPositions,
      setCursor,
      store,
      onTriggerLevelChange,
    }),
    [
      channels,
      timebase,
      resolvedTrigger,
      persistence,
      running,
      divisions,
      cursors,
      cursorPositions,
      setCursor,
      store,
      onTriggerLevelChange,
    ],
  );

  return (
    <ScopeContext value={value}>
      <div data-slot="scope" className={cn("flex flex-col gap-3", className)} {...props} />
    </ScopeContext>
  );
}

function drawGraticule(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  divisions: { x: number; y: number },
): void {
  const divW = width / divisions.x;
  const divH = height / divisions.y;
  ctx.save();
  ctx.lineWidth = 1;

  ctx.strokeStyle = "rgb(255 255 255 / 0.07)";
  ctx.setLineDash([1, 3]);
  ctx.beginPath();
  for (let i = 1; i < divisions.x; i += 1) {
    const x = Math.round(i * divW) + 0.5;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  for (let i = 1; i < divisions.y; i += 1) {
    const y = Math.round(i * divH) + 0.5;
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.strokeStyle = "rgb(255 255 255 / 0.16)";
  const cx = Math.round(width / 2) + 0.5;
  const cy = Math.round(height / 2) + 0.5;
  ctx.beginPath();
  ctx.moveTo(cx, 0);
  ctx.lineTo(cx, height);
  ctx.moveTo(0, cy);
  ctx.lineTo(width, cy);
  for (let i = 1; i < divisions.x * 5; i += 1) {
    const x = Math.round((i * divW) / 5) + 0.5;
    const tick = i % 5 === 0 ? 5 : 2.5;
    ctx.moveTo(x, cy - tick);
    ctx.lineTo(x, cy + tick);
  }
  for (let i = 1; i < divisions.y * 5; i += 1) {
    const y = Math.round((i * divH) / 5) + 0.5;
    const tick = i % 5 === 0 ? 5 : 2.5;
    ctx.moveTo(cx - tick, y);
    ctx.lineTo(cx + tick, y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawTrace(
  ctx: CanvasRenderingContext2D,
  values: ArrayLike<number>,
  start: number,
  windowLength: number,
  width: number,
  toY: (v: number) => number,
  color: string,
): void {
  const samplesPerPixel = windowLength / width;
  ctx.beginPath();

  if (samplesPerPixel > 2) {
    for (let px = 0; px < width; px += 1) {
      const from = Math.max(0, Math.floor(start + px * samplesPerPixel));
      const to = Math.min(values.length, Math.ceil(start + (px + 1) * samplesPerPixel));
      if (from >= to) continue;
      let min = Number.POSITIVE_INFINITY;
      let max = Number.NEGATIVE_INFINITY;
      for (let i = from; i < to; i += 1) {
        const v = values[i];
        if (v < min) min = v;
        if (v > max) max = v;
      }
      if (px === 0) ctx.moveTo(px, toY(min));
      ctx.lineTo(px, toY(min));
      ctx.lineTo(px, toY(max));
    }
  } else {
    const first = Math.max(0, Math.floor(start));
    const last = Math.min(values.length - 1, Math.ceil(start + windowLength));
    for (let i = first; i <= last; i += 1) {
      const x = ((i - start) / windowLength) * width;
      const y = toY(values[i]);
      if (i === first) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  }

  // A phosphor beam: two additive halos so overlapping channels add light, a solid body, and a
  // hot core mixed towards white. Browsers that cannot parse color-mix keep the body colour.
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = color;
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.07;
  ctx.lineWidth = 10;
  ctx.stroke();
  ctx.globalAlpha = 0.2;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.strokeStyle = `color-mix(in oklab, ${color}, white 45%)`;
  ctx.lineWidth = 0.7;
  ctx.stroke();
}

function drawMarker(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  text: string,
  side: "left" | "right",
): void {
  const dir = side === "left" ? 1 : -1;
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - 5);
  ctx.lineTo(x + dir * 14, y - 5);
  ctx.lineTo(x + dir * 19, y);
  ctx.lineTo(x + dir * 14, y + 5);
  ctx.lineTo(x, y + 5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgb(0 0 0 / 0.85)";
  ctx.font = "600 8px ui-monospace, monospace";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillText(text, x + dir * 7, y + 0.5);
  ctx.restore();
}

type CursorScale = { readout: CursorReadout; unit: string };

function useCursorScale(axis: CursorAxis): CursorScale {
  const { channels, timebase, trigger, divisions, cursorPositions } = useScope();
  if (axis === "time") {
    const triggerPosition = (trigger.pretrigger - 0.5) * divisions.x;
    return { readout: readCursors(cursorPositions.time, timebase, triggerPosition), unit: "s" };
  }
  const source = channels.find((c) => c.id === trigger.source) ?? channels[0];
  return {
    readout: readCursors(cursorPositions.voltage, source?.voltsPerDiv ?? 1, source?.offset ?? 0),
    unit: source?.unit ?? "V",
  };
}

function CursorLine({ axis, index }: { axis: CursorAxis; index: 0 | 1 }): ReactElement {
  const { divisions, cursorPositions, setCursor } = useScope();
  const { readout, unit } = useCursorScale(axis);
  const horizontal = axis === "voltage";
  const count = horizontal ? divisions.y : divisions.x;
  const position = cursorPositions[axis][index];
  const fraction = horizontal ? 0.5 - position / count : 0.5 + position / count;
  const value = index === 0 ? readout.a : readout.b;

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const screen = event.currentTarget.parentElement;
    if (!screen || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const rect = screen.getBoundingClientRect();
    const next = horizontal
      ? 0.5 - (event.clientY - rect.top) / rect.height
      : (event.clientX - rect.left) / rect.width - 0.5;
    setCursor(axis, index, next * count);
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 1 : CURSOR_STEP;
    const moves: Record<string, number> = {
      ArrowRight: position + step,
      ArrowUp: position + step,
      ArrowLeft: position - step,
      ArrowDown: position - step,
      Home: -count / 2,
      End: count / 2,
    };
    const next = moves[event.key];
    if (next === undefined) return;
    event.preventDefault();
    setCursor(axis, index, next);
  };

  return (
    <div
      // A native range input cannot be a full-height line dragged across the screen on either axis.
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
      role="slider"
      tabIndex={0}
      data-slot="scope-cursor"
      aria-label={`Cursor ${CURSOR_NAMES[index]}, ${axis}`}
      aria-orientation={horizontal ? "vertical" : "horizontal"}
      aria-valuemin={-count / 2}
      aria-valuemax={count / 2}
      aria-valuenow={Number(position.toFixed(2))}
      aria-valuetext={formatSi(value, unit)}
      className={cn(
        "group/cursor absolute z-10 flex touch-none outline-none select-none",
        horizontal
          ? "inset-x-0 h-6 -translate-y-1/2 cursor-ns-resize flex-col justify-center"
          : "inset-y-0 w-6 -translate-x-1/2 cursor-ew-resize justify-center",
      )}
      style={horizontal ? { top: `${fraction * 100}%` } : { left: `${fraction * 100}%` }}
      onPointerDown={(event) => {
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={onPointerMove}
      onKeyDown={onKeyDown}
    >
      <span
        aria-hidden
        className={cn(
          "border-dashed border-white/55 group-focus-visible/cursor:border-white",
          horizontal ? "w-full border-t" : "h-full border-l",
        )}
      />
      <span
        aria-hidden
        className={cn(
          "absolute rounded-[3px] bg-white/85 px-1 font-mono text-[9px] leading-[14px] font-semibold text-black group-focus-visible/cursor:bg-white group-focus-visible/cursor:ring-2 group-focus-visible/cursor:ring-white/50",
          horizontal ? "left-8" : "top-1.5",
        )}
      >
        {CURSOR_NAMES[index]}
      </span>
    </div>
  );
}

export type ScopeScreenProps = ComponentProps<"div"> & {
  graticule?: boolean;
};

function Screen({ graticule = true, className, ...props }: ScopeScreenProps): ReactElement {
  const {
    channels,
    timebase,
    trigger,
    persistence,
    running,
    divisions,
    cursors,
    store,
    onTriggerLevelChange,
  } = useScope();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  const dragging = useRef(false);

  const sourceIndex = Math.max(
    0,
    channels.findIndex((c) => c.id === trigger.source),
  );
  const source = channels[sourceIndex];

  const draw = useCallback(
    ({ ctx, width, height, time }: CanvasFrame) => {
      const canvas = ctx.canvas;
      const styles = getComputedStyle(canvas);
      const divH = height / divisions.y;
      const windowSeconds = timebase * divisions.x;
      const snapshot: ScopeSnapshot = { triggered: false, measurements: {} };

      let anchorFromEnd: number | null = null;
      if (source) {
        const values = getSamples(source);
        const windowLength = Math.max(2, Math.round(windowSeconds * source.sampleRate));
        const capture = captureWindow(values, {
          windowLength,
          pretrigger: trigger.pretrigger,
          level: trigger.level,
          edge: trigger.edge,
          hysteresis: (source.voltsPerDiv ?? 1) * 0.05,
          mode: trigger.mode,
        });
        if (!capture) return;
        snapshot.triggered = capture.triggered;
        anchorFromEnd = (values.length - capture.start) / source.sampleRate;
      }

      const fade = persistence > 0 && !reduced ? 1 - persistence : 1;
      ctx.globalAlpha = fade;
      ctx.fillStyle = styles.getPropertyValue("--scope-screen").trim() || SCREEN_FALLBACK;
      ctx.fillRect(0, 0, width, height);
      ctx.globalAlpha = 1;
      if (graticule) drawGraticule(ctx, width, height, divisions);

      channels.forEach((channel, index) => {
        if (channel.visible === false) return;
        const values = getSamples(channel);
        const windowLength = Math.max(2, Math.round(windowSeconds * channel.sampleRate));
        const start =
          anchorFromEnd === null
            ? values.length - windowLength
            : values.length - anchorFromEnd * channel.sampleRate;
        const voltsPerDiv = channel.voltsPerDiv ?? 1;
        const offset = channel.offset ?? 0;
        const toY = (v: number) => height / 2 - (v / voltsPerDiv + offset) * divH;
        const color = resolveCssColor(styles, channelColor(channel, index));

        drawTrace(ctx, values, start, windowLength, width, toY, color);
        drawMarker(ctx, 0, toY(0), color, String(index + 1), "left");
        const span = Math.min(values.length, windowLength * 8);
        snapshot.measurements[channel.id] = measure(
          values,
          channel.sampleRate,
          values.length - span,
          values.length,
        );
      });

      if (source) {
        const voltsPerDiv = source.voltsPerDiv ?? 1;
        const y = height / 2 - (trigger.level / voltsPerDiv + (source.offset ?? 0)) * divH;
        const color = resolveCssColor(styles, channelColor(source, sourceIndex));
        ctx.save();
        ctx.strokeStyle = color;
        ctx.globalAlpha = dragging.current ? 0.7 : 0.25;
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.moveTo(0, Math.round(y) + 0.5);
        ctx.lineTo(width, Math.round(y) + 0.5);
        ctx.stroke();
        ctx.restore();
        drawMarker(ctx, width, y, color, "T", "right");
      }

      store.publish(snapshot, time);
    },
    [
      channels,
      timebase,
      trigger,
      persistence,
      divisions,
      store,
      source,
      sourceIndex,
      graticule,
      reduced,
    ],
  );

  useCanvas(canvasRef, { draw, running });

  const levelFromPointer = (event: ReactPointerEvent<HTMLDivElement>): number | null => {
    const canvas = canvasRef.current;
    if (!canvas || !source) return null;
    const rect = canvas.getBoundingClientRect();
    const divH = rect.height / divisions.y;
    const y = event.clientY - rect.top;
    const level = ((rect.height / 2 - y) / divH - (source.offset ?? 0)) * (source.voltsPerDiv ?? 1);
    return Number(level.toFixed(3));
  };

  const interactive = Boolean(onTriggerLevelChange);
  const snapshot = useSyncExternalStore(store.subscribe, store.get, () => EMPTY_SNAPSHOT);
  const label = describe(channels, snapshot);

  return (
    <div
      data-slot="scope-screen"
      // `dark` because the screen is emissive in both themes: traces take the bright channel values.
      className={cn(
        "dark relative isolate aspect-[5/4] w-full overflow-hidden rounded-lg border border-black/40 bg-[var(--scope-screen,oklch(0.17_0.004_80))] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.04),inset_0_2px_12px_rgb(0_0_0/0.5)]",
        // The tube: the screen darkens towards its edges, over the canvas and under the pointer.
        "after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:bg-[radial-gradient(ellipse_at_center,transparent_55%,rgb(0_0_0/0.38)_100%)]",
        interactive && "cursor-ns-resize touch-none select-none",
        className,
      )}
      // The graticule in CSS as well, so the screen is ruled before the canvas paints its first frame.
      style={
        graticule
          ? {
              backgroundImage:
                "linear-gradient(to right, rgb(255 255 255 / 0.07) 1px, transparent 1px), linear-gradient(to bottom, rgb(255 255 255 / 0.07) 1px, transparent 1px)",
              backgroundSize: `${100 / divisions.x}% ${100 / divisions.y}%`,
            }
          : undefined
      }
      onPointerDown={(event) => {
        if (!interactive) return;
        dragging.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        const level = levelFromPointer(event);
        if (level !== null) onTriggerLevelChange?.(level);
      }}
      onPointerMove={(event) => {
        if (!dragging.current) return;
        const level = levelFromPointer(event);
        if (level !== null) onTriggerLevelChange?.(level);
      }}
      onPointerUp={() => {
        dragging.current = false;
      }}
      onPointerCancel={() => {
        dragging.current = false;
      }}
      {...props}
    >
      <canvas ref={canvasRef} aria-hidden className="block h-full w-full" />
      {cursors === "off" ? null : (
        <>
          <CursorLine axis={cursors} index={0} />
          <CursorLine axis={cursors} index={1} />
        </>
      )}
      <p className="sr-only">{label}</p>
    </div>
  );
}

function describe(channels: ScopeChannel[], snapshot: ScopeSnapshot): string {
  const parts = channels.map((channel, index) => {
    const m = snapshot.measurements[channel.id];
    const name = channel.label ?? `channel ${index + 1}`;
    if (!m) return name;
    const unit = channel.unit ?? "V";
    const freq = m.frequency === null ? "no periodic signal" : formatSi(m.frequency, "Hz");
    return `${name}: ${freq}, ${formatSi(m.peakToPeak, unit)} peak to peak`;
  });
  return `Oscilloscope. ${parts.join(". ")}.`;
}

export type ScopeReadoutProps = ComponentProps<"div">;

function Readout({ className, ...props }: ScopeReadoutProps): ReactElement {
  const { channels, timebase, trigger } = useScope();
  const source = channels.find((c) => c.id === trigger.source);
  return (
    <div
      data-slot="scope-readout"
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs tabular-nums",
        className,
      )}
      {...props}
    >
      {channels.map((channel, index) => (
        <span key={channel.id} className="inline-flex items-center gap-1.5 tabular-nums">
          <span
            aria-hidden
            className="size-2 rounded-[2px]"
            style={{ background: channelColor(channel, index) }}
          />
          <span className="text-muted-foreground">{channel.label ?? `CH${index + 1}`}</span>
          <span>{formatSi(channel.voltsPerDiv ?? 1, channel.unit ?? "V")}/div</span>
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5 tabular-nums">
        <span className="text-muted-foreground">Time</span>
        <span>{formatSi(timebase, "s")}/div</span>
      </span>
      <span className="inline-flex items-center gap-1.5 tabular-nums">
        <span className="text-muted-foreground">Trig</span>
        <span>
          {trigger.edge === "rising" ? "↑" : "↓"} {formatSi(trigger.level, source?.unit ?? "V")}
        </span>
        <span className="text-muted-foreground">{trigger.mode}</span>
      </span>
    </div>
  );
}

export type MeasurementKey = "frequency" | "period" | "peakToPeak" | "rms" | "mean" | "dutyCycle";

const MEASUREMENT_LABELS: Record<MeasurementKey, string> = {
  frequency: "Freq",
  period: "Period",
  peakToPeak: "Vpp",
  rms: "Vrms",
  mean: "Mean",
  dutyCycle: "Duty",
};

const DEFAULT_MEASUREMENTS: MeasurementKey[] = ["frequency", "period", "peakToPeak", "rms", "mean"];

export type ScopeMeasurementsProps = ComponentProps<"div"> & {
  /** Channel id. Defaults to the trigger source. */
  channel?: string;
  items?: MeasurementKey[];
};

function formatMeasurement(key: MeasurementKey, m: Measurements | undefined, unit: string): string {
  if (!m) return "--";
  switch (key) {
    case "frequency":
      return m.frequency === null ? "--" : formatSi(m.frequency, "Hz");
    case "period":
      return m.period === null ? "--" : formatSi(m.period, "s");
    case "dutyCycle":
      return m.dutyCycle === null ? "--" : `${(m.dutyCycle * 100).toFixed(1)} %`;
    case "peakToPeak":
      return formatSi(m.peakToPeak, unit);
    case "rms":
      return formatSi(m.rms, unit);
    case "mean":
      return formatSi(m.mean, unit);
  }
}

function Measurements({
  channel: channelId,
  items = DEFAULT_MEASUREMENTS,
  className,
  ...props
}: ScopeMeasurementsProps): ReactElement {
  const { channels, trigger, store } = useScope();
  const snapshot = useSyncExternalStore(store.subscribe, store.get, () => EMPTY_SNAPSHOT);
  const channel = channels.find((c) => c.id === (channelId ?? trigger.source)) ?? channels[0];
  const m = channel ? snapshot.measurements[channel.id] : undefined;
  const unit = channel?.unit ?? "V";

  return (
    <div
      data-slot="scope-measurements"
      className={cn("grid grid-cols-3 gap-x-4 gap-y-3 sm:grid-cols-5", className)}
      {...props}
    >
      {items.map((key) => (
        <ReadoutCell
          key={key}
          label={MEASUREMENT_LABELS[key]}
          value={formatMeasurement(key, m, unit)}
        />
      ))}
    </div>
  );
}

export type ScopeCursorsProps = ComponentProps<"div">;

function CursorReadouts({
  axis,
  className,
  ...props
}: ScopeCursorsProps & { axis: CursorAxis }): ReactElement {
  const { readout, unit } = useCursorScale(axis);
  const delta = Math.abs(readout.delta);
  return (
    <div
      data-slot="scope-cursors"
      className={cn("grid grid-cols-3 gap-x-4 gap-y-3 sm:grid-cols-5", className)}
      {...props}
    >
      <ReadoutCell label="A" value={formatSi(readout.a, unit)} />
      <ReadoutCell label="B" value={formatSi(readout.b, unit)} />
      <ReadoutCell label={axis === "time" ? "Δt" : "ΔV"} value={formatSi(delta, unit)} />
      {axis === "time" ? (
        <ReadoutCell label="1/Δt" value={delta > 0 ? formatSi(1 / delta, "Hz") : "--"} />
      ) : null}
    </div>
  );
}

function Cursors(props: ScopeCursorsProps): ReactElement | null {
  const { cursors } = useScope();
  return cursors === "off" ? null : <CursorReadouts axis={cursors} {...props} />;
}

function Status({ className, ...props }: ComponentProps<"span">): ReactElement {
  const { running, store } = useScope();
  const snapshot = useSyncExternalStore(store.subscribe, store.get, () => EMPTY_SNAPSHOT);
  const text = !running ? "Stop" : snapshot.triggered ? "Trig'd" : "Auto";
  return (
    <span
      data-slot="scope-status"
      className={cn("inline-flex items-center gap-1.5 text-xs", className)}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full",
          !running ? "bg-destructive" : snapshot.triggered ? "bg-success" : "bg-warning",
        )}
      />
      {text}
    </span>
  );
}

export const Scope = { Root, Screen, Readout, Measurements, Cursors, Status };

export type OscilloscopeProps = ScopeRootProps & {
  title?: ReactNode;
  measurements?: MeasurementKey[] | false;
};

export function Oscilloscope({
  title = "Oscilloscope",
  measurements = DEFAULT_MEASUREMENTS,
  className,
  children,
  ...props
}: OscilloscopeProps): ReactElement {
  return (
    <Root className={cn(INSTRUMENT_FRAME, className)} {...props}>
      <div className="flex items-center justify-between">
        <InstrumentLabel>{title}</InstrumentLabel>
        <Status />
      </div>
      <Screen />
      <Readout />
      {measurements ? <Measurements items={measurements} /> : null}
      <Cursors />
      {children}
    </Root>
  );
}
