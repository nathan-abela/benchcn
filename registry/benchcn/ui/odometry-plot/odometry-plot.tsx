// benchcn.dev · odometry-plot
// Where a robot has been and which way it faces, on a square grid in real units. The view fits the
// whole path with a margin, never zooms in past a minimum span, and grid lines land on round steps
// so distances can be read off directly.
import type { ComponentProps, ReactElement, ReactNode } from "react";

import { cn } from "@/lib/utils";
import { INSTRUMENT_FRAME, InstrumentLabel } from "@/registry/benchcn/lib/instrument";

export type OdometryPoint = { x: number; y: number };
/** `heading` in degrees, counterclockwise from +x. */
export type OdometryPose = OdometryPoint & { heading: number };

export type OdometryPlotProps = ComponentProps<"div"> & {
  /** Positions in order, oldest first. */
  path: ArrayLike<OdometryPoint>;
  pose?: OdometryPose | null;
  title?: ReactNode;
  unit?: string;
  /** Smallest half-width of the view, so a robot standing still is not zoomed to a point. */
  minSpan?: number;
};

export type OdometryView = { cx: number; cy: number; half: number };

/** A square view around every point and the pose, with a 15% margin. */
export function fitView(
  path: ArrayLike<OdometryPoint>,
  pose: OdometryPoint | null | undefined,
  minSpan: number,
): OdometryView {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  const add = (p: OdometryPoint) => {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  };
  for (let i = 0; i < path.length; i += 1) add(path[i]);
  if (pose) add(pose);
  if (!Number.isFinite(minX)) return { cx: 0, cy: 0, half: minSpan };
  const half = Math.max(minSpan, (Math.max(maxX - minX, maxY - minY) / 2) * 1.15);
  return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, half };
}

/** A 1, 2 or 5 step giving three to eight grid lines across the view. */
export function gridStep(half: number): number {
  const raw = (half * 2) / 6;
  const decade = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 5]) if (m * decade >= raw) return m * decade;
  return 10 * decade;
}

function format(value: number, step: number): string {
  return value.toFixed(Math.max(0, -Math.floor(Math.log10(step))));
}

export function OdometryPlot({
  path,
  pose,
  title = "Odometry",
  unit = "m",
  minSpan = 1,
  className,
  children,
  ...props
}: OdometryPlotProps): ReactElement {
  const view = fitView(path, pose, minSpan);
  const step = gridStep(view.half);
  const min = { x: view.cx - view.half, y: view.cy - view.half };
  const size = view.half * 2;
  const lines: number[] = [];
  for (let v = Math.ceil(min.x / step) * step; v <= min.x + size; v += step) lines.push(v);
  const rows: number[] = [];
  for (let v = Math.ceil(min.y / step) * step; v <= min.y + size; v += step) rows.push(v);

  const points = Array.from({ length: path.length }, (_, i) => `${path[i].x},${-path[i].y}`).join(
    " ",
  );
  const start = path.length > 0 ? path[0] : null;
  const marker = view.half * 0.07;
  const labelSize = view.half * 0.055;

  return (
    <div data-slot="odometry-plot" className={cn(INSTRUMENT_FRAME, className)} {...props}>
      <div className="flex items-center justify-between gap-3">
        <InstrumentLabel>{title}</InstrumentLabel>
        <InstrumentLabel className="tabular-nums">
          Grid {format(step, step)} {unit}
        </InstrumentLabel>
      </div>

      <svg
        aria-hidden
        viewBox={`${min.x} ${-(min.y + size)} ${size} ${size}`}
        className="bg-background aspect-square w-full rounded-lg border"
      >
        <g className="text-border" stroke="currentColor">
          {lines.map((x) => (
            <line
              key={`x${x}`}
              x1={x}
              x2={x}
              y1={-(min.y + size)}
              y2={-min.y}
              vectorEffect="non-scaling-stroke"
              strokeWidth={Math.abs(x) < step / 1000 ? 1.5 : 1}
            />
          ))}
          {rows.map((y) => (
            <line
              key={`y${y}`}
              y1={-y}
              y2={-y}
              x1={min.x}
              x2={min.x + size}
              vectorEffect="non-scaling-stroke"
              strokeWidth={Math.abs(y) < step / 1000 ? 1.5 : 1}
            />
          ))}
        </g>
        <g className="fill-muted-foreground" fontSize={labelSize}>
          {lines.slice(0, -1).map((x) => (
            <text key={`lx${x}`} x={x + labelSize * 0.3} y={-min.y - labelSize * 0.4}>
              {format(x, step)}
            </text>
          ))}
        </g>
        {start ? (
          <circle cx={start.x} cy={-start.y} r={marker * 0.35} className="fill-muted-foreground" />
        ) : null}
        {path.length > 1 ? (
          <polyline
            points={points}
            fill="none"
            stroke="var(--channel-2, var(--chart-2))"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        {pose ? (
          <g transform={`translate(${pose.x} ${-pose.y}) rotate(${-pose.heading})`}>
            <path
              d={`M ${marker} 0 L ${-marker * 0.7} ${marker * 0.6} L ${-marker * 0.35} 0 L ${-marker * 0.7} ${-marker * 0.6} Z`}
              className="fill-foreground"
            />
          </g>
        ) : null}
      </svg>

      <p className="text-muted-foreground flex justify-between text-xs tabular-nums">
        {pose ? (
          <>
            <span>
              x {pose.x.toFixed(2)} {unit}
            </span>
            <span>
              y {pose.y.toFixed(2)} {unit}
            </span>
            <span>heading {Math.round(pose.heading)}°</span>
          </>
        ) : (
          <span>No pose yet</span>
        )}
      </p>
      {children}
    </div>
  );
}
