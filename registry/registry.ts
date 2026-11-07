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
      "Adds --success and --warning colour tokens next to the shadcn --destructive token, mapped into Tailwind as bg-success, text-warning and friends.",
    cssVars: {
      theme: {
        "color-success": "var(--success)",
        "color-success-foreground": "var(--success-foreground)",
        "color-warning": "var(--warning)",
        "color-warning-foreground": "var(--warning-foreground)",
      },
      light: {
        success: "oklch(62.7% 0.194 149.214)",
        "success-foreground": "oklch(98.2% 0.018 155.826)",
        warning: "oklch(76.9% 0.188 70.08)",
        "warning-foreground": "oklch(27.9% 0.077 45.635)",
      },
      dark: {
        success: "oklch(72.3% 0.219 149.579)",
        "success-foreground": "oklch(26.6% 0.065 152.934)",
        warning: "oklch(82.8% 0.189 84.429)",
        "warning-foreground": "oklch(27.9% 0.077 45.635)",
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
];
