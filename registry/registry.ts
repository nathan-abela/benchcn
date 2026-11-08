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
  css?: Record<string, Record<string, Record<string, string>>>;
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
        "channel-1": "oklch(0.62 0.12 65)",
        "channel-2": "oklch(0.60 0.09 185)",
        "channel-3": "oklch(0.58 0.14 320)",
        "channel-4": "oklch(0.58 0.13 255)",
        "scope-screen": "oklch(0.19 0.004 80)",
      },
      dark: {
        success: "oklch(72.3% 0.219 149.579)",
        "success-foreground": "oklch(26.6% 0.065 152.934)",
        warning: "oklch(82.8% 0.189 84.429)",
        "warning-foreground": "oklch(27.9% 0.077 45.635)",
        "channel-1": "oklch(0.80 0.12 72)",
        "channel-2": "oklch(0.78 0.09 185)",
        "channel-3": "oklch(0.74 0.12 320)",
        "channel-4": "oklch(0.74 0.11 255)",
        "scope-screen": "oklch(0.15 0.004 80)",
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
    name: "source-store",
    type: "registry:lib",
    title: "Source store",
    description:
      "Turns any transport that speaks the wire protocol into one subscribable snapshot: readings, histories, logs and actuators tracked through their acknowledgements.",
    files: [{ path: "registry/benchcn/lib/source-store.ts", type: "registry:lib" }],
    registryDependencies: [`${ns}/actuator`, `${ns}/wire`],
    categories: ["data"],
    docs: docsUrl("hooks"),
  },
  {
    name: "use-mock-device",
    type: "registry:hook",
    title: "useMockDevice",
    description:
      "React binding for the mock device: live readings, histories, logs, tracked actuators and a command helper. Swap for a real source when the hardware is ready.",
    files: [{ path: "registry/benchcn/hooks/use-mock-device.ts", type: "registry:hook" }],
    registryDependencies: [`${ns}/mock-device`, `${ns}/source-store`],
    categories: ["data"],
    docs: docsUrl("hooks/use-mock-device"),
  },
  {
    name: "use-websocket-source",
    type: "registry:hook",
    title: "useWebSocketSource",
    description:
      "WebSocket source speaking the wire protocol, with reconnect and backoff, returning the same snapshot as the mock device.",
    files: [{ path: "registry/benchcn/hooks/use-websocket-source.ts", type: "registry:hook" }],
    registryDependencies: [`${ns}/source-store`],
    categories: ["data"],
    docs: docsUrl("hooks/use-websocket-source"),
  },
  {
    name: "use-serial-source",
    type: "registry:hook",
    title: "useSerialSource",
    description:
      "Web Serial source for a board on USB, opened from a user gesture, returning the same snapshot as the mock device.",
    files: [{ path: "registry/benchcn/hooks/use-serial-source.ts", type: "registry:hook" }],
    registryDependencies: [`${ns}/source-store`, `${ns}/use-websocket-source`],
    categories: ["data"],
    docs: docsUrl("hooks/use-serial-source"),
  },
  {
    name: "use-ring-buffer",
    type: "registry:hook",
    title: "useRingBuffer",
    description:
      "Fills a ring buffer with one channel's samples and blocks from a source so scopes can read it every frame without React state.",
    files: [{ path: "registry/benchcn/hooks/use-ring-buffer.ts", type: "registry:hook" }],
    registryDependencies: [`${ns}/ring-buffer`, `${ns}/source-store`],
    categories: ["data"],
    docs: docsUrl("hooks/use-ring-buffer"),
  },
  {
    name: "decoders",
    type: "registry:lib",
    title: "Protocol decoders",
    description:
      "Pure I2C, SPI and UART decoders with matching encoders: logic levels in, frames out, and back again for tests and demos.",
    files: [
      { path: "registry/benchcn/lib/decoders/i2c.ts", type: "registry:lib" },
      { path: "registry/benchcn/lib/decoders/spi.ts", type: "registry:lib" },
      { path: "registry/benchcn/lib/decoders/uart.ts", type: "registry:lib" },
    ],
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
    name: "status-led",
    type: "registry:ui",
    title: "Status LED",
    description:
      "Panel LED with physical colour presets, on and off states, and blink, pulse or heartbeat patterns that stop under reduced motion.",
    files: [{ path: "registry/benchcn/ui/status-led/status-led.tsx", type: "registry:ui" }],
    css: {
      "@keyframes benchcn-blink": {
        "0%, 49%": { opacity: "1" },
        "50%, 100%": { opacity: "0.12" },
      },
      "@keyframes benchcn-pulse": {
        "0%, 100%": { opacity: "1" },
        "50%": { opacity: "0.25" },
      },
      "@keyframes benchcn-heartbeat": {
        "0%, 28%, 100%": { opacity: "0.15" },
        "6%, 18%": { opacity: "1" },
      },
    },
    categories: ["displays"],
    docs: docsUrl("components/status-led"),
  },
  {
    name: "seven-segment",
    type: "registry:ui",
    title: "Seven-segment display",
    description:
      "SVG seven-segment readout with real segment geometry, faint unlit segments, decimals, colons, minus and a few letters, in physical colours.",
    files: [{ path: "registry/benchcn/ui/seven-segment/seven-segment.tsx", type: "registry:ui" }],
    categories: ["displays"],
    docs: docsUrl("components/seven-segment"),
  },
  {
    name: "sensor-tile",
    type: "registry:ui",
    title: "Sensor tile",
    description:
      "One reading with unit, a state derived from thresholds, a range bar, a sparkline and automatic stale detection when samples stop.",
    files: [{ path: "registry/benchcn/ui/sensor-tile/sensor-tile.tsx", type: "registry:ui" }],
    registryDependencies: [`${ns}/tokens`, `${ns}/instrument`],
    categories: ["readouts"],
    docs: docsUrl("components/sensor-tile"),
  },
  {
    name: "strip-chart",
    type: "registry:ui",
    title: "Strip chart",
    description:
      "Rolling multi-series trend for slow channels: time axis, overlay or stacked lanes by unit, pause, hover readout, line breaks where samples stopped, and CSV export of everything recorded.",
    files: [
      { path: "registry/benchcn/ui/strip-chart/strip-chart.tsx", type: "registry:ui" },
      { path: "registry/benchcn/hooks/use-strip-series.ts", type: "registry:hook" },
      { path: "registry/benchcn/lib/strip-chart.ts", type: "registry:lib" },
    ],
    registryDependencies: [
      "button",
      `${ns}/tokens`,
      `${ns}/instrument`,
      `${ns}/use-canvas`,
      `${ns}/source-store`,
    ],
    categories: ["readouts"],
    docs: docsUrl("components/strip-chart"),
  },
  {
    name: "character-lcd",
    type: "registry:ui",
    title: "Character LCD",
    description:
      "HD44780-style character LCD drawn pixel for pixel from the A00 character ROM, with module colour presets, backlight, cursor and custom glyphs.",
    files: [
      { path: "registry/benchcn/ui/character-lcd/character-lcd.tsx", type: "registry:ui" },
      { path: "registry/benchcn/lib/hd44780-rom.ts", type: "registry:lib" },
    ],
    registryDependencies: [`${ns}/status-led`],
    categories: ["displays"],
    docs: docsUrl("components/character-lcd"),
  },
  {
    name: "serial-console",
    type: "registry:ui",
    title: "Serial console",
    description:
      "Device logs and a command line in one panel: levels, timestamps, follow mode that pauses when you scroll up, and command history.",
    files: [{ path: "registry/benchcn/ui/serial-console/serial-console.tsx", type: "registry:ui" }],
    registryDependencies: [`${ns}/tokens`, `${ns}/instrument`, `${ns}/wire`],
    categories: ["comms"],
    docs: docsUrl("components/serial-console"),
  },
  {
    name: "boards",
    type: "registry:lib",
    title: "Board pinouts",
    description:
      "Typed pinout data for the Raspberry Pi 40-pin header, Raspberry Pi Pico, ESP32-DevKitC V4 and Arduino UNO R3, each citing the official document it was typed from.",
    files: [
      {
        path: "registry/benchcn/boards/types.ts",
        type: "registry:lib",
        target: "lib/boards/types.ts",
      },
      {
        path: "registry/benchcn/boards/index.ts",
        type: "registry:lib",
        target: "lib/boards/index.ts",
      },
      {
        path: "registry/benchcn/boards/raspberry-pi-40pin.ts",
        type: "registry:lib",
        target: "lib/boards/raspberry-pi-40pin.ts",
      },
      {
        path: "registry/benchcn/boards/raspberry-pi-pico.ts",
        type: "registry:lib",
        target: "lib/boards/raspberry-pi-pico.ts",
      },
      {
        path: "registry/benchcn/boards/esp32-devkitc-v4.ts",
        type: "registry:lib",
        target: "lib/boards/esp32-devkitc-v4.ts",
      },
      {
        path: "registry/benchcn/boards/arduino-uno-r3.ts",
        type: "registry:lib",
        target: "lib/boards/arduino-uno-r3.ts",
      },
    ],
    categories: ["board"],
    docs: docsUrl("components/pinout-header"),
  },
  {
    name: "pinout-header",
    type: "registry:ui",
    title: "Pinout header",
    description:
      "Board pinout diagram from typed data with an official source, with your wiring drawn on top and pin, bus-role and reserved-pin conflicts called out.",
    files: [
      { path: "registry/benchcn/ui/pinout-header/pinout-header.tsx", type: "registry:ui" },
      { path: "registry/benchcn/lib/pinout.ts", type: "registry:lib" },
    ],
    registryDependencies: [`${ns}/tokens`, `${ns}/instrument`, `${ns}/boards`],
    categories: ["board"],
    docs: docsUrl("components/pinout-header"),
  },
  {
    name: "bitfield-diagram",
    type: "registry:ui",
    title: "Bitfield diagram",
    description:
      "Register bit layout with named fields, reserved bits hatched, the current value decoded per field, and clickable bits for editing a register.",
    files: [
      { path: "registry/benchcn/ui/bitfield-diagram/bitfield-diagram.tsx", type: "registry:ui" },
      { path: "registry/benchcn/lib/bitfield.ts", type: "registry:lib" },
    ],
    registryDependencies: [`${ns}/tokens`, `${ns}/instrument`],
    categories: ["board"],
    docs: docsUrl("components/bitfield-diagram"),
  },
  {
    name: "timing-diagram",
    type: "registry:ui",
    title: "Timing diagram",
    description:
      "Datasheet-style timing figures from WaveJSON-like signal strings: clocks, levels, buses with labels, unknown and high-impedance states.",
    files: [
      { path: "registry/benchcn/ui/timing-diagram/timing-diagram.tsx", type: "registry:ui" },
      { path: "registry/benchcn/lib/wavejson.ts", type: "registry:lib" },
    ],
    registryDependencies: [`${ns}/tokens`, `${ns}/instrument`],
    categories: ["board"],
    docs: docsUrl("components/timing-diagram"),
  },
  {
    name: "plant-monitor",
    type: "registry:block",
    title: "Plant monitor",
    description:
      "Complete plant dashboard block: soil, climate and light tiles, a pump with commanded-versus-confirmed state, a status LCD, link LEDs and a console, with a kiosk layout for 800x480 screens.",
    files: [
      {
        path: "registry/benchcn/blocks/plant-monitor/plant-monitor.tsx",
        type: "registry:component",
      },
    ],
    registryDependencies: [
      `${ns}/use-mock-device`,
      `${ns}/sensor-tile`,
      `${ns}/actuator-control`,
      `${ns}/character-lcd`,
      `${ns}/serial-console`,
      `${ns}/status-led`,
    ],
    categories: ["blocks"],
    docs: docsUrl("blocks/plant-monitor"),
  },
  {
    name: "weather-station",
    type: "registry:block",
    title: "Weather station",
    description:
      "Weather dashboard block: seven-segment temperature, climate tiles with sparklines, computed dew point, pressure trend on an LCD and a low-battery LED, with a kiosk layout.",
    files: [
      {
        path: "registry/benchcn/blocks/weather-station/weather-station.tsx",
        type: "registry:component",
      },
    ],
    registryDependencies: [
      `${ns}/use-mock-device`,
      `${ns}/sensor-tile`,
      `${ns}/seven-segment`,
      `${ns}/character-lcd`,
      `${ns}/status-led`,
    ],
    categories: ["blocks"],
    docs: docsUrl("blocks/weather-station"),
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
