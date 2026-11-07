// benchcn.dev · registry manifest
// Source of truth for registry.json; scripts/build-registry.mts serialises it.
import { siteConfig } from "../config/site.ts";

type ItemType =
  | "registry:ui"
  | "registry:component"
  | "registry:lib"
  | "registry:hook"
  | "registry:block"
  | "registry:item"
  | "registry:theme";

export type RegistryItem = {
  name: string;
  type: ItemType;
  title: string;
  description: string;
  files?: { path: string; type: ItemType; target?: string }[];
  dependencies?: string[];
  registryDependencies?: string[];
  cssVars?: {
    theme?: Record<string, string>;
    light?: Record<string, string>;
    dark?: Record<string, string>;
  };
  categories?: string[];
  docs?: string;
  meta?: Record<string, unknown>;
};

const docsUrl = (slug: string) => `${siteConfig.url}/docs/${slug}`;
const ns = siteConfig.registry.namespace;

export const registry: RegistryItem[] = [
  {
    name: "tokens",
    type: "registry:item",
    title: "benchcn tokens",
    description:
      "Adds --success and --warning next to the shadcn --destructive token, and --channel-1 to --channel-4 instrument colours for scope traces and analyzer lanes, all mapped into Tailwind (bg-success, text-channel-1).",
    cssVars: {
      theme: {
        "color-success": "var(--success)",
        "color-success-foreground": "var(--success-foreground)",
        "color-warning": "var(--warning)",
        "color-warning-foreground": "var(--warning-foreground)",
        "color-channel-1": "var(--channel-1)",
        "color-channel-2": "var(--channel-2)",
        "color-channel-3": "var(--channel-3)",
        "color-channel-4": "var(--channel-4)",
      },
      light: {
        success: "oklch(62.7% 0.194 149.214)",
        "success-foreground": "oklch(98.2% 0.018 155.826)",
        warning: "oklch(76.9% 0.188 70.08)",
        "warning-foreground": "oklch(27.9% 0.077 45.635)",
        "channel-1": "oklch(0.80 0.16 85)",
        "channel-2": "oklch(0.70 0.12 200)",
        "channel-3": "oklch(0.66 0.20 340)",
        "channel-4": "oklch(0.62 0.17 262)",
      },
      dark: {
        success: "oklch(72.3% 0.219 149.579)",
        "success-foreground": "oklch(26.6% 0.065 152.934)",
        warning: "oklch(82.8% 0.189 84.429)",
        "warning-foreground": "oklch(27.9% 0.077 45.635)",
        "channel-1": "oklch(0.88 0.17 92)",
        "channel-2": "oklch(0.84 0.12 200)",
        "channel-3": "oklch(0.76 0.20 340)",
        "channel-4": "oklch(0.72 0.16 262)",
      },
    },
    categories: ["theme"],
    docs: docsUrl("theming"),
  },
  {
    name: "wire",
    type: "registry:lib",
    title: "Wire protocol",
    description:
      "Types, parser and serialiser for the benchcn wire protocol: JSON lines carrying telemetry samples, actuator commands and acknowledgements.",
    files: [{ path: "registry/benchcn/lib/wire.ts", type: "registry:lib" }],
    categories: ["data"],
    docs: docsUrl("wire-protocol"),
  },
  {
    name: "ring-buffer",
    type: "registry:lib",
    title: "Ring buffer",
    description:
      "Fixed-capacity typed-array ring buffer for high-rate samples, with time-windowed reads for scopes and strip charts.",
    files: [{ path: "registry/benchcn/lib/ring-buffer.ts", type: "registry:lib" }],
    categories: ["data"],
    docs: docsUrl("hooks/use-ring-buffer"),
  },
  {
    name: "mock-device",
    type: "registry:lib",
    title: "Mock device",
    description:
      "Deterministic simulated bench device: slow sensors, waveform channels, I2C traffic, a relay with acknowledgement latency and occasional faults. Powers every demo.",
    files: [{ path: "registry/benchcn/lib/mock-device.ts", type: "registry:lib" }],
    registryDependencies: [`${ns}/wire`],
    categories: ["data"],
    docs: docsUrl("data-sources"),
  },
  {
    name: "instrument",
    type: "registry:lib",
    title: "Instrument chrome",
    description:
      "Shared bezel, engraved labels, numeric readouts, channel colour tokens and the reduced-motion hook used by every benchcn instrument.",
    files: [{ path: "registry/benchcn/lib/instrument.tsx", type: "registry:lib" }],
    registryDependencies: [`${ns}/tokens`],
    categories: ["data"],
    docs: docsUrl("theming"),
  },
  {
    name: "units",
    type: "registry:lib",
    title: "Units",
    description:
      "Engineering notation (250 µs, 1.00 kHz) and 1-2-5 knob stepping for timebases and ranges.",
    files: [{ path: "registry/benchcn/lib/units.ts", type: "registry:lib" }],
    categories: ["data"],
    docs: docsUrl("hooks"),
  },
  {
    name: "use-canvas",
    type: "registry:hook",
    title: "useCanvas",
    description:
      "Device-pixel-ratio aware canvas sizing with a frame loop that pauses offscreen and respects reduced motion.",
    files: [{ path: "registry/benchcn/hooks/use-canvas.ts", type: "registry:hook" }],
    categories: ["data"],
    docs: docsUrl("hooks"),
  },
  {
    name: "actuator",
    type: "registry:lib",
    title: "Actuator tracker",
    description:
      "Follows a command through acknowledgement, timeout and fail-safe so UI can show commanded versus confirmed state.",
    files: [{ path: "registry/benchcn/lib/actuator.ts", type: "registry:lib" }],
    categories: ["data"],
    docs: docsUrl("components/actuator-control"),
  },
  {
    name: "use-mock-device",
    type: "registry:hook",
    title: "useMockDevice",
    description:
      "React binding for the mock device: live readings, logs, tracked actuators and a command helper. Swap for a real source when the hardware is ready.",
    files: [{ path: "registry/benchcn/hooks/use-mock-device.ts", type: "registry:hook" }],
    registryDependencies: [`${ns}/mock-device`, `${ns}/actuator`, `${ns}/wire`],
    categories: ["data"],
    docs: docsUrl("data-sources"),
  },
  {
    name: "decoders",
    type: "registry:lib",
    title: "Protocol decoders",
    description:
      "Pure I2C decoder and encoder: turns SDA/SCL logic levels into start, address, data, ack and stop frames, and back again for tests and demos.",
    files: [{ path: "registry/benchcn/lib/decoders/i2c.ts", type: "registry:lib" }],
    categories: ["data"],
    docs: docsUrl("hooks/decoders"),
  },
  {
    name: "oscilloscope",
    type: "registry:ui",
    title: "Oscilloscope",
    description:
      "Working oscilloscope for analog waveforms: edge trigger with hysteresis, timebase and volts per division, phosphor persistence, and live frequency, period, Vpp, Vrms and mean measurements.",
    files: [
      { path: "registry/benchcn/ui/oscilloscope/oscilloscope.tsx", type: "registry:ui" },
      { path: "registry/benchcn/lib/scope-math.ts", type: "registry:lib" },
    ],
    registryDependencies: [`${ns}/tokens`, `${ns}/instrument`, `${ns}/units`, `${ns}/use-canvas`],
    categories: ["signals"],
    docs: docsUrl("components/oscilloscope"),
  },
  {
    name: "logic-analyzer",
    type: "registry:ui",
    title: "Logic analyzer",
    description:
      "Digital lanes with zoom, pan, a time ruler and in-place I2C decode: start, address, read/write, data bytes, ack and stop drawn over the SDA lane.",
    files: [{ path: "registry/benchcn/ui/logic-analyzer/logic-analyzer.tsx", type: "registry:ui" }],
    registryDependencies: [
      "button",
      `${ns}/tokens`,
      `${ns}/instrument`,
      `${ns}/units`,
      `${ns}/use-canvas`,
      `${ns}/decoders`,
    ],
    categories: ["signals"],
    docs: docsUrl("components/logic-analyzer"),
  },
  {
    name: "actuator-control",
    type: "registry:ui",
    title: "Actuator control",
    description:
      "Press-and-hold switch for relays, pumps and motor enables that shows commanded versus confirmed state, acknowledgement latency, timeout and fail-safe.",
    files: [
      { path: "registry/benchcn/ui/actuator-control/actuator-control.tsx", type: "registry:ui" },
    ],
    dependencies: ["motion"],
    registryDependencies: [`${ns}/tokens`, `${ns}/instrument`, `${ns}/actuator`],
    categories: ["controls"],
    docs: docsUrl("components/actuator-control"),
  },
];
