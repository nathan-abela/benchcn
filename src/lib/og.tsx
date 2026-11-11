import type { ReactElement, ReactNode } from "react";
import { ImageResponse } from "takumi-js/response";

import { OG_SIZE } from "@/lib/shared";
import { createMockDevice } from "@/registry/benchcn/lib/mock-device";

import { siteConfig } from "../../config/site";

/** Takumi does not resolve CSS variables, so the dark theme tokens are copied here as hex. */
const COLORS = {
  background: "#09090b",
  foreground: "#fafafa",
  muted: "#9f9fa9",
  border: "#27272a",
  screen: "#0c0b09",
  channel1: "#edb161",
  channel2: "#6fcabf",
};

export function ogImageResponse(element: ReactElement): ImageResponse {
  return new ImageResponse(element, { ...OG_SIZE, format: "png" });
}

function Mark(): ReactElement {
  return (
    <svg width="44" height="44" viewBox="0 0 20 20" fill="none">
      <rect
        x="0.5"
        y="0.5"
        width="19"
        height="19"
        rx="4.5"
        fill={COLORS.background}
        stroke={COLORS.border}
      />
      <path
        d="M4.5 13h2.5V7h3v6h3V7h2.5"
        stroke={COLORS.foreground}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Frame({ children }: { children: ReactNode }): ReactElement {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        position: "relative",
        width: "100%",
        height: "100%",
        padding: "64px 72px",
        backgroundColor: COLORS.background,
        color: COLORS.foreground,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <Mark />
        <span style={{ fontSize: 30, fontWeight: 600, letterSpacing: -0.6 }}>
          {siteConfig.name}
        </span>
      </div>
      {children}
    </div>
  );
}

const DIVISIONS = { x: 10, y: 8 };
const TIMEBASE_S = 0.0002;
const POINTS = 600;

/** The landing bench's scope settings, sampled from the same mock device at a fixed time. */
const TRACES = [
  { id: "ch1", color: COLORS.channel1, voltsPerDiv: 0.5, offset: 0 },
  { id: "ch2", color: COLORS.channel2, voltsPerDiv: 1, offset: -2.5 },
];

function tracePath(
  data: Float32Array,
  width: number,
  height: number,
  voltsPerDiv: number,
  offset: number,
): string {
  const divH = height / DIVISIONS.y;
  return Array.from(data, (v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height / 2 - (v / voltsPerDiv + offset) * divH;
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join("");
}

function ScopeScreen({ width, height }: { width: number; height: number }): ReactElement {
  const device = createMockDevice({ seed: 7 });
  const windowS = TIMEBASE_S * DIVISIONS.x;
  const sampleRate = (POINTS - 1) / windowS;
  const divW = width / DIVISIONS.x;
  const divH = height / DIVISIONS.y;
  const grid = [
    ...Array.from({ length: DIVISIONS.x - 1 }, (_, i) => `M${(i + 1) * divW} 0V${height}`),
    ...Array.from({ length: DIVISIONS.y - 1 }, (_, i) => `M0 ${(i + 1) * divH}H${width}`),
  ].join("");
  const ticks = Array.from({ length: DIVISIONS.x * 5 - 1 }, (_, i) => {
    const x = ((i + 1) * divW) / 5;
    const tick = (i + 1) % 5 === 0 ? 8 : 4;
    return `M${x} ${height / 2 - tick}V${height / 2 + tick}`;
  }).join("");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <rect width={width} height={height} fill={COLORS.screen} />
      <path d={grid} stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" strokeDasharray="2 6" />
      <path
        d={`M${width / 2} 0V${height}M0 ${height / 2}H${width}${ticks}`}
        stroke="rgba(255,255,255,0.16)"
        strokeWidth="1.5"
      />
      {TRACES.map((trace) => {
        const data = device.waveform(trace.id, 1, POINTS, sampleRate);
        const y0 = height / 2 - trace.offset * divH;
        return (
          <g key={trace.id}>
            <path
              d={tracePath(data, width, height, trace.voltsPerDiv, trace.offset)}
              stroke={trace.color}
              strokeWidth="3"
              strokeLinejoin="round"
              fill="none"
            />
            <path d={`M0 ${y0 - 10}h28l10 10l-10 10h-28z`} fill={trace.color} />
          </g>
        );
      })}
    </svg>
  );
}

export function LandingImage(): ReactElement {
  const screen = { width: 640, height: 512 };
  return (
    <Frame>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 24,
          marginTop: "auto",
          width: 470,
        }}
      >
        <span style={{ fontSize: 68, fontWeight: 500, lineHeight: 1.02, letterSpacing: -2 }}>
          Hardware UI for shadcn/ui
        </span>
        <span style={{ fontSize: 28, lineHeight: 1.35, color: COLORS.muted }}>
          Instruments, displays and controls that work with real hardware.
        </span>
      </div>
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: 620,
          top: 112,
          padding: 14,
          borderRadius: 24,
          border: `1.5px solid ${COLORS.border}`,
          backgroundColor: "#111113",
        }}
      >
        <div
          style={{
            display: "flex",
            borderRadius: 12,
            overflow: "hidden",
            border: "1.5px solid rgba(0,0,0,0.6)",
          }}
        >
          <ScopeScreen {...screen} />
        </div>
      </div>
    </Frame>
  );
}

export function DocsImage({
  title,
  description,
}: {
  title: string;
  description?: string;
}): ReactElement {
  return (
    <Frame>
      <div style={{ display: "flex", flexDirection: "column", gap: 24, marginTop: "auto" }}>
        <span style={{ fontSize: 76, fontWeight: 500, lineHeight: 1.05, letterSpacing: -2.2 }}>
          {title}
        </span>
        {description ? (
          <span
            style={{
              fontSize: 32,
              lineHeight: 1.4,
              color: COLORS.muted,
              maxWidth: 980,
              lineClamp: 3,
              textOverflow: "ellipsis",
            }}
          >
            {description}
          </span>
        ) : null}
      </div>
    </Frame>
  );
}
