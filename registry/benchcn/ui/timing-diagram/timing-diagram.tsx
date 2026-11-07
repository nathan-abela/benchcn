// benchcn.dev · timing-diagram
// Datasheet-style timing figures from WaveJSON-like signal descriptions, drawn as SVG with
// slanted transitions, bus hexagons and hatched unknowns.
import { type ComponentProps, type ReactElement, type ReactNode, useId, useMemo } from "react";

import { cn } from "@/lib/utils";
import { channelToken, INSTRUMENT_FRAME, InstrumentLabel } from "@/registry/benchcn/lib/instrument";
import {
  parseWave,
  type WaveSegment,
  type WaveSignal,
  waveLength,
} from "@/registry/benchcn/lib/wavejson";

export type TimingDiagramProps = ComponentProps<"div"> & {
  signals: WaveSignal[];
  /** Pixels per cycle. */
  hscale?: number;
  title?: ReactNode;
  caption?: ReactNode;
  /** Draw a faint line at every cycle. */
  grid?: boolean;
};

const ROW = 34;
const HIGH = 6;
const LOW = 28;
const SLANT = 3;
const NAME_W = 72;

function levelY(kind: WaveSegment["kind"], edge: "start" | "end"): number {
  switch (kind) {
    case "high":
      return HIGH;
    case "low":
      return LOW;
    case "z":
      return (HIGH + LOW) / 2;
    case "clock-pos":
      return edge === "start" ? LOW : HIGH;
    case "clock-neg":
      return edge === "start" ? HIGH : LOW;
    default:
      return (HIGH + LOW) / 2;
  }
}

function clockPath(segment: WaveSegment, hscale: number, period: number): string {
  const parts: string[] = [];
  const pos = segment.kind === "clock-pos";
  for (let c = segment.start; c < segment.end; c += period) {
    const x0 = c * hscale;
    const xm = x0 + (period * hscale) / 2;
    const x1 = x0 + period * hscale;
    const a = pos ? LOW : HIGH;
    const b = pos ? HIGH : LOW;
    parts.push(`M${x0},${a} L${x0},${b} L${xm},${b} L${xm},${a} L${x1},${a}`);
  }
  return parts.join(" ");
}

export function TimingDiagram({
  signals,
  hscale = 36,
  title = "Timing",
  caption,
  grid = true,
  className,
  children,
  ...props
}: TimingDiagramProps): ReactElement {
  const id = useId();
  const cycles = useMemo(() => waveLength(signals), [signals]);
  const width = NAME_W + cycles * hscale + 8;
  const height = signals.length * ROW + 8;

  return (
    <div data-slot="timing-diagram" className={cn(INSTRUMENT_FRAME, "gap-3", className)} {...props}>
      <InstrumentLabel>{title}</InstrumentLabel>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width={width}
          height={height}
          className="block font-mono"
          aria-hidden
        >
          <defs>
            <pattern
              id={`${id}-x`}
              width={6}
              height={6}
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <line
                x1={0}
                y1={0}
                x2={0}
                y2={6}
                stroke="currentColor"
                strokeOpacity={0.35}
                strokeWidth={1.5}
              />
            </pattern>
          </defs>
          {grid
            ? Array.from({ length: cycles + 1 }, (_, c) => (
                <line
                  key={c}
                  x1={NAME_W + c * hscale + 0.5}
                  x2={NAME_W + c * hscale + 0.5}
                  y1={4}
                  y2={height - 4}
                  stroke="currentColor"
                  strokeOpacity={0.07}
                />
              ))
            : null}
          {signals.map((signal, row) => {
            const period = signal.period ?? 1;
            const phase = signal.phase ?? 0;
            const segments = parseWave(signal.wave, signal.data, period);
            const y0 = 4 + row * ROW;
            const x = (cycle: number) => NAME_W + (cycle + phase) * hscale;
            return (
              <g key={signal.name} transform={`translate(0 ${y0})`}>
                <text
                  x={NAME_W - 10}
                  y={(HIGH + LOW) / 2}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fontSize={11}
                  className="fill-foreground"
                >
                  {signal.name}
                </text>
                {segments.map((segment, i) => {
                  const prev = segments[i - 1];
                  const x0 = x(segment.start);
                  const x1 = x(segment.end);
                  const stroke = "currentColor";
                  if (segment.kind === "gap") {
                    return (
                      <path
                        key={`gap-${segment.start}`}
                        d={`M${x0 - 3},${LOW + 3} q3,-8 0,-11 q-3,-8 0,-11`}
                        fill="none"
                        stroke={stroke}
                        strokeWidth={1.5}
                      />
                    );
                  }
                  if (segment.kind === "clock-pos" || segment.kind === "clock-neg") {
                    return (
                      <path
                        key={segment.start}
                        d={clockPath(
                          { ...segment, start: segment.start + phase, end: segment.end + phase },
                          hscale,
                          period,
                        )}
                        transform={`translate(${NAME_W} 0)`}
                        fill="none"
                        stroke={stroke}
                        strokeWidth={1.5}
                        strokeLinejoin="round"
                      />
                    );
                  }
                  if (segment.kind === "data" || segment.kind === "x") {
                    const fill =
                      segment.kind === "x" ? `url(#${id}-x)` : channelToken(segment.color ?? 1);
                    const d = `M${x0},${(HIGH + LOW) / 2} L${x0 + SLANT},${HIGH} L${x1 - SLANT},${HIGH} L${x1},${(HIGH + LOW) / 2} L${x1 - SLANT},${LOW} L${x0 + SLANT},${LOW} Z`;
                    return (
                      <g key={segment.start}>
                        <path
                          d={d}
                          fill={fill}
                          fillOpacity={segment.kind === "x" ? 1 : 0.2}
                          stroke={stroke}
                          strokeWidth={1.25}
                          strokeLinejoin="round"
                        />
                        {segment.label ? (
                          <text
                            x={(x0 + x1) / 2}
                            y={(HIGH + LOW) / 2}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fontSize={10}
                            className="fill-foreground"
                          >
                            {segment.label}
                          </text>
                        ) : null}
                      </g>
                    );
                  }
                  const yStart = prev ? levelY(prev.kind, "end") : levelY(segment.kind, "start");
                  const y = levelY(segment.kind, "start");
                  const from =
                    prev && prev.kind !== "data" && prev.kind !== "x" && prev.kind !== "gap"
                      ? `M${x0},${yStart} L${x0 + (yStart === y ? 0 : SLANT)},${y}`
                      : `M${x0},${y}`;
                  return (
                    <path
                      key={segment.start}
                      d={`${from} L${x1},${y}`}
                      fill="none"
                      stroke={stroke}
                      strokeWidth={1.5}
                      strokeLinejoin="round"
                      strokeDasharray={segment.kind === "z" ? "3 3" : undefined}
                    />
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>
      {caption ? <p className="text-muted-foreground text-xs">{caption}</p> : null}
      <p className="sr-only">
        Timing diagram with {signals.length} signals: {signals.map((s) => s.name).join(", ")}.
      </p>
      {children}
    </div>
  );
}
