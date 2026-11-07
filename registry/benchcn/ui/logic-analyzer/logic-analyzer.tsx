// benchcn.dev · logic-analyzer
// Digital lanes with zoom and pan, a time ruler, and protocol decode drawn in place. Decoders are
// pure functions; this file only draws what they return.
import {
  type ComponentProps,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type CanvasFrame, useCanvas } from "@/registry/benchcn/hooks/use-canvas";
import {
  decodeI2c,
  formatI2cFrame,
  type I2cFrame,
  summarizeI2c,
} from "@/registry/benchcn/lib/decoders/i2c";
import {
  channelToken,
  INSTRUMENT_FRAME,
  InstrumentLabel,
  resolveCssColor,
} from "@/registry/benchcn/lib/instrument";
import { formatSi } from "@/registry/benchcn/lib/units";

export type LogicLane = {
  id: string;
  label?: string;
  /** Any CSS colour. Defaults to `--channel-n` from @benchcn/tokens, then `--chart-n`. */
  color?: string;
  /** Logic levels, 0 or 1. */
  data: ArrayLike<number>;
  sampleRate: number;
};

export type LogicDecode = {
  protocol: "i2c";
  /** Lane ids. */
  sda: string;
  scl: string;
};

export type TimeWindow = { start: number; end: number };

export type DecodedTransaction = {
  /** Seconds. */
  start: number;
  end: number;
  text: string;
  frames: I2cFrame[];
};

export type LogicAnalyzerProps = ComponentProps<"div"> & {
  lanes: LogicLane[];
  decode?: LogicDecode;
  title?: ReactNode;
  /** Visible window in seconds. Leave undefined to let the analyzer manage zoom and pan. */
  window?: TimeWindow;
  onWindowChange?: (window: TimeWindow) => void;
  laneHeight?: number;
  /** Render the decoded transactions as a list under the lanes. */
  list?: boolean;
};

const RULER_HEIGHT = 22;
const DECODE_HEIGHT = 26;
const MIN_SAMPLES_ON_SCREEN = 16;
const SCREEN_FALLBACK = "oklch(0.17 0.004 80)";
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

function laneColor(lane: LogicLane, index: number): string {
  return lane.color ?? channelToken(index + 1);
}

function duration(lanes: LogicLane[]): number {
  return lanes.reduce((max, lane) => Math.max(max, lane.data.length / lane.sampleRate), 0);
}

function minSpan(lanes: LogicLane[]): number {
  const rate = lanes.reduce((max, lane) => Math.max(max, lane.sampleRate), 1);
  return MIN_SAMPLES_ON_SCREEN / rate;
}

function niceStep(span: number, pixels: number, minPixels = 90): number {
  const raw = (span / pixels) * minPixels;
  const decade = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 5, 10]) if (m * decade >= raw) return m * decade;
  return 10 * decade;
}

function groupTransactions(frames: I2cFrame[], sampleRate: number): DecodedTransaction[] {
  const lines = summarizeI2c(frames).split("\n").filter(Boolean);
  const groups: I2cFrame[][] = [];
  for (const frame of frames) {
    if (frame.kind === "start" || frame.kind === "repeated-start" || groups.length === 0) {
      groups.push([]);
    }
    groups[groups.length - 1].push(frame);
  }
  return groups
    .filter((group) => group.some((f) => f.kind === "address"))
    .map((group, i) => ({
      start: group[0].start / sampleRate,
      end: group[group.length - 1].end / sampleRate,
      text: lines[i] ?? "",
      frames: group,
    }));
}

function drawLane(
  ctx: CanvasRenderingContext2D,
  lane: LogicLane,
  window: TimeWindow,
  width: number,
  top: number,
  height: number,
  color: string,
): void {
  const { data, sampleRate } = lane;
  const yHigh = top + 6;
  const yLow = top + height - 6;
  const span = window.end - window.start;
  const toX = (sample: number) => ((sample / sampleRate - window.start) / span) * width;
  const first = Math.max(0, Math.floor(window.start * sampleRate));
  const last = Math.min(data.length - 1, Math.ceil(window.end * sampleRate));
  if (last < first) return;
  const samplesPerPixel = (last - first) / width;

  ctx.beginPath();
  if (samplesPerPixel > 1.5) {
    for (let px = 0; px <= width; px += 1) {
      const from = Math.max(first, Math.floor(first + px * samplesPerPixel));
      const to = Math.min(last, Math.floor(first + (px + 1) * samplesPerPixel));
      let any0 = false;
      let any1 = false;
      for (let i = from; i <= to; i += 1) {
        if (data[i]) any1 = true;
        else any0 = true;
        if (any0 && any1) break;
      }
      const x = px + 0.5;
      if (any0 && any1) {
        ctx.moveTo(x, yHigh);
        ctx.lineTo(x, yLow);
      } else {
        const y = any1 ? yHigh : yLow;
        ctx.moveTo(x, y);
        ctx.lineTo(x + 1, y);
      }
    }
  } else {
    let level = data[first] ? yHigh : yLow;
    ctx.moveTo(toX(first), level);
    for (let i = first + 1; i <= last; i += 1) {
      const next = data[i] ? yHigh : yLow;
      if (next !== level) {
        const x = toX(i);
        ctx.lineTo(x, level);
        ctx.lineTo(x, next);
        level = next;
      }
    }
    ctx.lineTo(toX(last + 1), level);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.lineJoin = "miter";
  ctx.stroke();
}

type Palette = {
  foreground: string;
  muted: string;
  success: string;
  destructive: string;
  address: string;
};

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + radius, radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
  ctx.lineTo(x + radius, y + h);
  ctx.arcTo(x, y + h, x, y + h - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

function drawDecode(
  ctx: CanvasRenderingContext2D,
  frames: I2cFrame[],
  sampleRate: number,
  window: TimeWindow,
  width: number,
  top: number,
  palette: Palette,
): void {
  const span = window.end - window.start;
  const toX = (sample: number) => ((sample / sampleRate - window.start) / span) * width;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  const y = top + DECODE_HEIGHT / 2;
  const h = 18;

  for (const frame of frames) {
    const x0 = toX(frame.start);
    const x1 = toX(frame.end);
    if (x1 < 0 || x0 > width) continue;
    const w = Math.max(2, x1 - x0);

    if (frame.kind === "start" || frame.kind === "repeated-start" || frame.kind === "stop") {
      ctx.fillStyle = frame.kind === "stop" ? palette.destructive : palette.success;
      ctx.beginPath();
      ctx.arc(x0 + w / 2, y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgb(0 0 0 / 0.85)";
      ctx.font = `700 8px ${MONO}`;
      ctx.fillText(formatI2cFrame(frame)[0], x0 + w / 2, y + 0.5);
      continue;
    }

    const color = frame.kind === "address" ? palette.address : palette.muted;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.18;
    roundRect(ctx, x0 + 1, y - h / 2, w - 2, h, 4);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    roundRect(ctx, x0 + 1.5, y - h / 2 + 0.5, w - 3, h - 1, 4);
    ctx.stroke();

    ctx.font = `500 11px ${MONO}`;
    const label = formatI2cFrame(frame) + (frame.ack === false ? " ✕" : "");
    const textWidth = ctx.measureText(label).width;
    ctx.fillStyle = palette.foreground;
    if (w > textWidth + 10) ctx.fillText(label, x0 + w / 2, y + 0.5);
    else if (w > 14) ctx.fillText("…", x0 + w / 2, y + 0.5);
  }
}

function drawRuler(
  ctx: CanvasRenderingContext2D,
  window: TimeWindow,
  width: number,
  height: number,
  muted: string,
): void {
  const span = window.end - window.start;
  const step = niceStep(span, width);
  const first = Math.ceil(window.start / step) * step;
  ctx.font = `10px ${MONO}`;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillStyle = muted;
  ctx.strokeStyle = "rgb(255 255 255 / 0.08)";
  ctx.lineWidth = 1;

  for (let t = first; t <= window.end + step / 2; t += step) {
    const x = Math.round(((t - window.start) / span) * width) + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, RULER_HEIGHT - 6);
    ctx.lineTo(x, height);
    ctx.stroke();
    ctx.fillText(formatSi(Math.abs(t) < step / 1000 ? 0 : t, "s"), x + 4, 5);
  }
}

function drawCursor(
  ctx: CanvasRenderingContext2D,
  x: number,
  window: TimeWindow,
  width: number,
  height: number,
  foreground: string,
): void {
  const px = Math.round(x) + 0.5;
  ctx.strokeStyle = "rgb(255 255 255 / 0.45)";
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(px, 0);
  ctx.lineTo(px, height);
  ctx.stroke();
  ctx.setLineDash([]);
  const t = window.start + (x / width) * (window.end - window.start);
  const text = formatSi(t, "s");
  ctx.font = `10px ${MONO}`;
  const w = ctx.measureText(text).width + 8;
  const bx = Math.min(width - w, Math.max(0, px + 6));
  ctx.fillStyle = "rgb(0 0 0 / 0.75)";
  ctx.fillRect(bx, 4, w, 14);
  ctx.fillStyle = foreground;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText(text, bx + 4, 6);
}

export function LogicAnalyzer({
  lanes,
  decode,
  title = "Logic analyzer",
  window: controlledWindow,
  onWindowChange,
  laneHeight = 36,
  list = true,
  className,
  children,
  ...props
}: LogicAnalyzerProps): ReactElement {
  const total = useMemo(() => duration(lanes), [lanes]);
  const [inner, setInner] = useState<{ total: number; window: TimeWindow }>({
    total,
    window: { start: 0, end: total },
  });
  const window = useMemo(
    () => controlledWindow ?? (inner.total === total ? inner.window : { start: 0, end: total }),
    [controlledWindow, inner, total],
  );

  const setWindow = useCallback(
    (next: TimeWindow) => {
      const span = Math.max(next.end - next.start, minSpan(lanes));
      const start = Math.min(Math.max(0, next.start), Math.max(0, total - span));
      const clamped = { start, end: Math.min(total, start + span) };
      onWindowChange?.(clamped);
      if (!controlledWindow) setInner({ total, window: clamped });
    },
    [controlledWindow, lanes, onWindowChange, total],
  );

  const decoded = useMemo(() => {
    if (!decode) return null;
    const sda = lanes.find((l) => l.id === decode.sda);
    const scl = lanes.find((l) => l.id === decode.scl);
    if (!sda || !scl) return null;
    const frames = decodeI2c({ sda: sda.data, scl: scl.data, sampleRate: sda.sampleRate });
    return {
      frames,
      sampleRate: sda.sampleRate,
      transactions: groupTransactions(frames, sda.sampleRate),
      laneIndex: lanes.indexOf(sda),
    };
  }, [decode, lanes]);

  const rows = useMemo(() => {
    const out: { kind: "decode" | "lane"; index: number; top: number; height: number }[] = [];
    let top = RULER_HEIGHT;
    lanes.forEach((_, index) => {
      if (decoded && index === decoded.laneIndex) {
        out.push({ kind: "decode", index, top, height: DECODE_HEIGHT });
        top += DECODE_HEIGHT;
      }
      out.push({ kind: "lane", index, top, height: laneHeight });
      top += laneHeight;
    });
    return { rows: out, height: top + 6 };
  }, [lanes, decoded, laneHeight]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const hover = useRef<number | null>(null);
  const drag = useRef<{ x: number; start: number } | null>(null);

  const draw = useCallback(
    ({ ctx, width, height }: CanvasFrame) => {
      const styles = getComputedStyle(ctx.canvas);
      const palette: Palette = {
        foreground: "rgb(255 255 255 / 0.92)",
        muted: "rgb(255 255 255 / 0.55)",
        success: resolveCssColor(styles, "var(--success)"),
        destructive: resolveCssColor(styles, "var(--destructive)"),
        address: resolveCssColor(styles, channelToken(1)),
      };
      ctx.fillStyle = styles.getPropertyValue("--scope-screen").trim() || SCREEN_FALLBACK;
      ctx.fillRect(0, 0, width, height);
      drawRuler(ctx, window, width, height, palette.muted);

      for (const row of rows.rows) {
        if (row.kind === "lane") {
          const lane = lanes[row.index];
          ctx.strokeStyle = "rgb(255 255 255 / 0.06)";
          ctx.beginPath();
          ctx.moveTo(0, row.top + row.height - 0.5);
          ctx.lineTo(width, row.top + row.height - 0.5);
          ctx.stroke();
          const color = resolveCssColor(styles, laneColor(lane, row.index));
          drawLane(ctx, lane, window, width, row.top, row.height, color);
        } else if (decoded) {
          drawDecode(ctx, decoded.frames, decoded.sampleRate, window, width, row.top, palette);
        }
      }

      if (hover.current !== null) {
        drawCursor(ctx, hover.current, window, width, height, palette.foreground);
      }
    },
    [lanes, decoded, rows, window],
  );

  const { redraw } = useCanvas(canvasRef, { draw, running: false });

  const zoom = useCallback(
    (factor: number, anchor = 0.5) => {
      const span = window.end - window.start;
      const next = span * factor;
      const pivot = window.start + span * anchor;
      setWindow({ start: pivot - next * anchor, end: pivot + next * (1 - anchor) });
    },
    [window, setWindow],
  );

  const pan = useCallback(
    (fraction: number) => {
      const span = window.end - window.start;
      setWindow({ start: window.start + span * fraction, end: window.end + span * fraction });
    },
    [window, setWindow],
  );

  useEffect(() => {
    const element = wrapperRef.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      if (event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        pan((event.deltaX || event.deltaY) / rect.width);
      } else {
        zoom(event.deltaY > 0 ? 1.25 : 0.8, (event.clientX - rect.left) / rect.width);
      }
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [pan, zoom]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, start: window.start };
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    hover.current = event.clientX - rect.left;
    if (drag.current) {
      const span = window.end - window.start;
      const dt = ((event.clientX - drag.current.x) / rect.width) * span;
      setWindow({ start: drag.current.start - dt, end: drag.current.start - dt + span });
    } else {
      redraw();
    }
  };
  const endDrag = () => {
    drag.current = null;
  };
  const onPointerLeave = () => {
    hover.current = null;
    drag.current = null;
    redraw();
  };

  const span = window.end - window.start;
  const summary = decoded ? summarizeI2c(decoded.frames) : "";

  return (
    <div data-slot="logic-analyzer" className={cn(INSTRUMENT_FRAME, className)} {...props}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <InstrumentLabel>{title}</InstrumentLabel>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground font-mono text-[11px] uppercase tabular-nums">
            {decode ? `${decode.protocol} · ` : ""}
            {formatSi(span, "s")} shown · {formatSi(lanes[0]?.sampleRate ?? 0, "S/s")}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-xs"
              aria-label="Zoom out"
              onClick={() => zoom(1.25)}
            >
              −
            </Button>
            <Button variant="outline" size="icon-xs" aria-label="Zoom in" onClick={() => zoom(0.8)}>
              +
            </Button>
            <Button
              variant="outline"
              size="xs"
              aria-label="Fit to capture"
              onClick={() => setWindow({ start: 0, end: total })}
            >
              Fit
            </Button>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <div
          className="flex shrink-0 flex-col font-mono text-[11px]"
          style={{ paddingTop: RULER_HEIGHT }}
          aria-hidden
        >
          {rows.rows.map((row) => (
            <div
              key={`${row.kind}-${row.index}`}
              className={cn(
                "flex w-12 items-center justify-end pr-2 tracking-wider uppercase",
                row.kind === "decode" ? "text-muted-foreground/70" : "text-muted-foreground",
              )}
              style={{ height: row.height }}
            >
              {row.kind === "decode"
                ? decode?.protocol
                : (lanes[row.index].label ?? lanes[row.index].id)}
            </div>
          ))}
        </div>
        <div
          ref={wrapperRef}
          aria-hidden
          className="relative min-w-0 flex-1 cursor-grab touch-none overflow-hidden rounded-lg border border-black/40 select-none active:cursor-grabbing"
          style={{ height: rows.height }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onPointerLeave={onPointerLeave}
        >
          <canvas ref={canvasRef} className="block h-full w-full" />
        </div>
      </div>
      <p className="sr-only">
        Logic analyzer, {lanes.length} lanes. {summary.replaceAll("\n", ". ")}
      </p>

      {list && decoded ? (
        <ol className="flex flex-col gap-0.5 font-mono text-xs">
          {decoded.transactions.map((transaction) => (
            <li key={transaction.start}>
              <button
                type="button"
                className="hover:bg-accent flex w-full items-center gap-3 rounded-md px-2 py-1 text-left tabular-nums"
                onClick={() => {
                  const pad = (transaction.end - transaction.start) * 0.1;
                  setWindow({ start: transaction.start - pad, end: transaction.end + pad });
                }}
              >
                <span className="text-muted-foreground w-16 shrink-0">
                  {formatSi(transaction.start, "s")}
                </span>
                <span className="truncate">{transaction.text}</span>
              </button>
            </li>
          ))}
        </ol>
      ) : null}
      {children}
    </div>
  );
}

export type { I2cFrame };
