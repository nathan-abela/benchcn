// benchcn.dev · strip-chart
// A rolling trend for slow channels: several series on a time axis, pause, a hover readout, honest
// gaps where samples stopped, and CSV export of everything recorded, not just what is in view.
import {
  type ComponentProps,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type CanvasFrame, useCanvas } from "@/registry/benchcn/hooks/use-canvas";
import type { StripSeries } from "@/registry/benchcn/hooks/use-strip-series";
import {
  channelToken,
  INSTRUMENT_FRAME,
  InstrumentLabel,
  resolveCssColor,
} from "@/registry/benchcn/lib/instrument";
import {
  firstAtOrAfter,
  nearestPoint,
  splitAtGaps,
  type StripPoint,
  type StripRange,
  tickStep,
  ticks,
  toCsv,
  valueRange,
  visibleSlice,
} from "@/registry/benchcn/lib/strip-chart";

export type { StripSeries } from "@/registry/benchcn/hooks/use-strip-series";

export type StripChartLayout = "auto" | "overlay" | "stacked";

export type StripChartProps = ComponentProps<"div"> & {
  series: StripSeries[];
  title?: ReactNode;
  /** Width of the visible window in seconds. */
  seconds?: number;
  /** Fixed value range shared by every series in an overlay chart. */
  min?: number;
  max?: number;
  /** `auto` stacks series into their own lanes when their units differ, and overlays them otherwise. */
  layout?: StripChartLayout;
  /** Milliseconds without a sample before a series reports stale and its line breaks. */
  staleAfter?: number;
  /** Plot height in pixels for an overlay chart; a stacked chart sizes each lane from it. */
  height?: number;
  paused?: boolean;
  onPausedChange?: (paused: boolean) => void;
  /** File name for the CSV export, without the extension. */
  exportName?: string;
};

const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";
const AXIS_HEIGHT = 18;
const LANE_GAP = 8;

function seriesColor(series: StripSeries, index: number): string {
  return series.color ?? channelToken(index + 1);
}

function lastPoint(series: StripSeries): StripPoint | undefined {
  return series.points.length > 0 ? series.points[series.points.length - 1] : undefined;
}

function formatValue(value: number, step?: number): string {
  if (step !== undefined) return value.toFixed(Math.max(0, -Math.floor(Math.log10(step))));
  const abs = Math.abs(value);
  return value.toFixed(abs >= 100 ? 0 : abs >= 10 ? 1 : 2);
}

function formatOffset(ms: number): string {
  if (Math.abs(ms) < 1) return "now";
  const s = ms / 1000;
  return `${Number.isInteger(s) ? s : s.toFixed(1)} s`;
}

function download(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${name}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/** Re-renders on an interval so staleness shows even when no samples arrive. */
function useNow(interval: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), interval);
    return () => window.clearInterval(id);
  }, [interval]);
  return now;
}

type Lane = { series: number[]; top: number; height: number; range: StripRange | null };

export function StripChart({
  series,
  title = "Trend",
  seconds = 60,
  min,
  max,
  layout = "auto",
  staleAfter = 5000,
  height = 200,
  paused: controlledPaused,
  onPausedChange,
  exportName = "benchcn-trend",
  className,
  children,
  ...props
}: StripChartProps): ReactElement {
  const [frozenAt, setFrozenAt] = useState<number | null>(null);
  const paused = controlledPaused ?? frozenAt !== null;
  const now = useNow(1000);
  const [seenPaused, setSeenPaused] = useState(controlledPaused);
  if (controlledPaused !== seenPaused) {
    setSeenPaused(controlledPaused);
    setFrozenAt(controlledPaused ? now : null);
  }
  const viewEnd = paused ? (frozenAt ?? now) : now;
  const [hover, setHover] = useState<{ time: number; offset: number } | null>(null);
  const hoverTime = hover?.time ?? null;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hoverX = useRef<number | null>(null);
  const gutterRef = useRef(40);
  const span = seconds * 1000;

  const units = new Set(series.map((s) => s.unit ?? ""));
  const stacked = layout === "stacked" || (layout === "auto" && units.size > 1);
  const plotHeight = stacked
    ? Math.max(height, series.length * 64 + (series.length - 1) * LANE_GAP)
    : height;

  const setPaused = (next: boolean) => {
    setFrozenAt(next ? Date.now() : null);
    onPausedChange?.(next);
  };

  const draw = useCallback(
    ({ ctx, width, height: canvasHeight }: CanvasFrame) => {
      const styles = getComputedStyle(ctx.canvas);
      const muted = resolveCssColor(styles, "var(--muted-foreground)");
      const grid = resolveCssColor(styles, "var(--border)");
      const foreground = resolveCssColor(styles, "var(--foreground)");
      ctx.clearRect(0, 0, width, canvasHeight);

      const right = paused ? (frozenAt ?? Date.now()) : Date.now();
      const left = right - span;
      const slices = series.map((s) => visibleSlice(s.points, left, right));
      const plotBottom = canvasHeight - AXIS_HEIGHT;

      const lanes: Lane[] = stacked
        ? series.map((s, i) => {
            const laneHeight = (plotBottom - LANE_GAP * (series.length - 1)) / series.length;
            return {
              series: [i],
              top: i * (laneHeight + LANE_GAP),
              height: laneHeight,
              range: valueRange([slices[i]], { min: s.min, max: s.max }),
            };
          })
        : [
            {
              series: series.map((_, i) => i),
              top: 0,
              height: plotBottom,
              range: valueRange(slices, { min, max }),
            },
          ];

      ctx.font = `10px ${MONO}`;
      const laneTicks = lanes.map((lane) =>
        lane.range ? ticks(lane.range, Math.max(2, Math.floor(lane.height / 36))) : [],
      );
      const labels = lanes.map((lane, i) => {
        if (!lane.range) return [];
        const step = tickStep(
          lane.range.max - lane.range.min,
          Math.max(2, Math.floor(lane.height / 36)),
        );
        return laneTicks[i].map((v) => formatValue(v, step));
      });
      const gutter = Math.ceil(
        Math.max(24, ...labels.flat().map((text) => ctx.measureText(text).width)) + 10,
      );
      gutterRef.current = gutter;
      const plotWidth = Math.max(1, width - gutter);
      const toX = (t: number) => gutter + ((t - left) / span) * plotWidth;

      lanes.forEach((lane, laneIndex) => {
        const { range } = lane;
        if (!range) return;
        const toY = (v: number) =>
          lane.top + lane.height - ((v - range.min) / (range.max - range.min)) * lane.height;

        ctx.lineWidth = 1;
        ctx.strokeStyle = grid;
        ctx.fillStyle = muted;
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        laneTicks[laneIndex].forEach((v, i) => {
          const y = Math.round(toY(v)) + 0.5;
          // A tick on a lane edge would collide with the next lane's label.
          if (stacked && (y < lane.top + 5 || y > lane.top + lane.height - 5)) return;
          ctx.beginPath();
          ctx.moveTo(gutter, y);
          ctx.lineTo(width, y);
          ctx.stroke();
          ctx.fillText(labels[laneIndex][i], gutter - 8, y);
        });

        ctx.save();
        ctx.beginPath();
        ctx.rect(gutter, lane.top, plotWidth, lane.height);
        ctx.clip();
        for (const index of lane.series) {
          const color = resolveCssColor(styles, seriesColor(series[index], index));
          const last = lastPoint(series[index]);
          const stale = !last || right - last.t > staleAfter;
          ctx.globalAlpha = stale ? 0.45 : 1;
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.5;
          ctx.lineJoin = "round";
          for (const run of splitAtGaps(slices[index], staleAfter)) {
            ctx.beginPath();
            run.forEach((p, i) => {
              if (i === 0) ctx.moveTo(toX(p.t), toY(p.v));
              else ctx.lineTo(toX(p.t), toY(p.v));
            });
            if (run.length === 1) ctx.lineTo(toX(run[0].t) + 1, toY(run[0].v));
            ctx.stroke();
          }
          if (last && last.t >= left) {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(toX(last.t), toY(last.v), 2.5, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
        }

        if (hoverX.current !== null) {
          const t = left + ((hoverX.current - gutter) / plotWidth) * span;
          for (const index of lane.series) {
            const point = nearestPoint(slices[index], t, staleAfter);
            if (!point) continue;
            ctx.fillStyle = resolveCssColor(styles, seriesColor(series[index], index));
            ctx.beginPath();
            ctx.arc(toX(point.t), toY(point.v), 3.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      });

      const step = tickStep(span, Math.max(2, Math.floor(plotWidth / 70)));
      ctx.fillStyle = muted;
      ctx.textBaseline = "bottom";
      for (let offset = 0; offset <= span + 1; offset += step) {
        const x = toX(right - offset);
        ctx.textAlign = offset === 0 ? "right" : x - gutter < 30 ? "left" : "center";
        ctx.fillText(offset === 0 ? "now" : `-${formatOffset(offset)}`, x, canvasHeight);
      }

      if (hoverX.current !== null && hoverX.current >= gutter) {
        const x = Math.round(hoverX.current) + 0.5;
        ctx.strokeStyle = foreground;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, plotBottom);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    },
    [series, paused, frozenAt, span, stacked, min, max, staleAfter],
  );

  const { redraw } = useCanvas(canvasRef, { draw, running: !paused });

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    hoverX.current = x;
    const gutter = gutterRef.current;
    const plotWidth = Math.max(1, rect.width - gutter);
    const right = paused ? (frozenAt ?? Date.now()) : Date.now();
    const offset = span - ((x - gutter) / plotWidth) * span;
    setHover(x < gutter ? null : { time: right - offset, offset });
    redraw();
  };
  const onPointerLeave = () => {
    hoverX.current = null;
    setHover(null);
    redraw();
  };

  // While paused the legend reads the frozen moment, not samples recorded since.
  const readouts = series.map((s, index) => {
    const last = paused ? s.points[firstAtOrAfter(s.points, viewEnd + 1) - 1] : lastPoint(s);
    const point = hoverTime === null ? last : nearestPoint(s.points, hoverTime, staleAfter);
    const stale = !last || viewEnd - last.t > staleAfter;
    return { series: s, index, point, stale };
  });

  return (
    <div
      data-slot="strip-chart"
      data-paused={paused}
      className={cn(INSTRUMENT_FRAME, className)}
      {...props}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <InstrumentLabel>{title}</InstrumentLabel>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-muted-foreground text-xs tabular-nums">
            {hover === null ? `${seconds} s` : `-${formatOffset(hover.offset)}`}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="xs"
              aria-pressed={paused}
              onClick={() => setPaused(!paused)}
            >
              {paused ? "Resume" : "Pause"}
            </Button>
            <Button
              variant="outline"
              size="xs"
              disabled={series.every((s) => s.points.length === 0)}
              onClick={() => download(exportName, toCsv(series))}
            >
              Export CSV
            </Button>
          </div>
        </div>
      </div>

      <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
        {readouts.map(({ series: s, index, point, stale }) => (
          <li key={s.id} className="inline-flex items-center gap-1.5 tabular-nums">
            <span
              aria-hidden
              className={cn("size-2 rounded-[2px]", stale && "opacity-45")}
              style={{ background: seriesColor(s, index) }}
            />
            <span className="text-muted-foreground">{s.label ?? s.id}</span>
            <span className="font-medium">
              {point ? formatValue(point.v) : "--"}
              {point && s.unit ? (
                <span className="text-muted-foreground ml-0.5">{s.unit}</span>
              ) : null}
            </span>
            {stale && hoverTime === null ? (
              <span className="text-muted-foreground">Stale</span>
            ) : null}
          </li>
        ))}
      </ul>

      <div
        className="relative touch-pan-y"
        style={{ height: plotHeight + AXIS_HEIGHT }}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
      >
        <canvas ref={canvasRef} aria-hidden className="block h-full w-full" />
      </div>
      <p className="sr-only">
        {readouts
          .map(({ series: s, point, stale }) =>
            point
              ? `${s.label ?? s.id} ${formatValue(point.v)} ${s.unit ?? ""}${stale ? ", stale" : ""}`
              : `${s.label ?? s.id} no data`,
          )
          .join(". ")}
      </p>
      {children}
    </div>
  );
}
