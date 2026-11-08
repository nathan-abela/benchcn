import { type ComponentType, lazy } from "react";

import type { PlaceholderHeights } from "@/components/site/placeholder";

import actuatorControlSource from "./actuator-control-demo.tsx?raw";
import bitfieldDiagramSource from "./bitfield-diagram-demo.tsx?raw";
import characterLcdSource from "./character-lcd-demo.tsx?raw";
import logicAnalyzerSource from "./logic-analyzer-demo.tsx?raw";
import oscilloscopeSource from "./oscilloscope-demo.tsx?raw";
import pinoutHeaderSource from "./pinout-header-demo.tsx?raw";
import plantMonitorSource from "./plant-monitor-demo.tsx?raw";
import sensorTileSource from "./sensor-tile-demo.tsx?raw";
import serialConsoleSource from "./serial-console-demo.tsx?raw";
import sevenSegmentSource from "./seven-segment-demo.tsx?raw";
import statusLedSource from "./status-led-demo.tsx?raw";
import stripChartSource from "./strip-chart-demo.tsx?raw";
import timingDiagramSource from "./timing-diagram-demo.tsx?raw";
import weatherStationSource from "./weather-station-demo.tsx?raw";

export type Demo = {
  component: ComponentType;
  source: string;
  placeholder: PlaceholderHeights;
};

export const demos: Record<string, Demo> = {
  oscilloscope: {
    component: lazy(() =>
      import("./oscilloscope-demo").then((m) => ({ default: m.OscilloscopeDemo })),
    ),
    source: oscilloscopeSource,
    placeholder: { base: 540, sm: 640, md: 600, lg: 750, xl: 720 },
  },
  "logic-analyzer": {
    component: lazy(() =>
      import("./logic-analyzer-demo").then((m) => ({ default: m.LogicAnalyzerDemo })),
    ),
    source: logicAnalyzerSource,
    placeholder: { base: 483, sm: 459 },
  },
  "actuator-control": {
    component: lazy(() =>
      import("./actuator-control-demo").then((m) => ({ default: m.ActuatorControlDemo })),
    ),
    source: actuatorControlSource,
    placeholder: { base: 500, sm: 428 },
  },
  "status-led": {
    component: lazy(() => import("./status-led-demo").then((m) => ({ default: m.StatusLedDemo }))),
    source: statusLedSource,
    placeholder: { base: 152, sm: 100 },
  },
  "seven-segment": {
    component: lazy(() =>
      import("./seven-segment-demo").then((m) => ({ default: m.SevenSegmentDemo })),
    ),
    source: sevenSegmentSource,
    placeholder: { base: 256 },
  },
  "sensor-tile": {
    component: lazy(() =>
      import("./sensor-tile-demo").then((m) => ({ default: m.SensorTileDemo })),
    ),
    source: sensorTileSource,
    placeholder: { base: 756, sm: 392, lg: 256 },
  },
  "strip-chart": {
    component: lazy(() =>
      import("./strip-chart-demo").then((m) => ({ default: m.StripChartDemo })),
    ),
    source: stripChartSource,
    placeholder: { base: 643, sm: 567, lg: 361 },
  },
  "character-lcd": {
    component: lazy(() =>
      import("./character-lcd-demo").then((m) => ({ default: m.CharacterLcdDemo })),
    ),
    source: characterLcdSource,
    placeholder: { base: 435, md: 400, lg: 347, xl: 280 },
  },
  "pinout-header": {
    component: lazy(() =>
      import("./pinout-header-demo").then((m) => ({ default: m.PinoutHeaderDemo })),
    ),
    source: pinoutHeaderSource,
    placeholder: { base: 880, sm: 770, md: 800, lg: 761 },
  },
  "bitfield-diagram": {
    component: lazy(() =>
      import("./bitfield-diagram-demo").then((m) => ({ default: m.BitfieldDiagramDemo })),
    ),
    source: bitfieldDiagramSource,
    placeholder: { base: 850, sm: 720, md: 780, lg: 720 },
  },
  "timing-diagram": {
    component: lazy(() =>
      import("./timing-diagram-demo").then((m) => ({ default: m.TimingDiagramDemo })),
    ),
    source: timingDiagramSource,
    placeholder: { base: 592, sm: 544, xl: 530 },
  },
  "plant-monitor": {
    component: lazy(() =>
      import("./plant-monitor-demo").then((m) => ({ default: m.PlantMonitorDemo })),
    ),
    source: plantMonitorSource,
    placeholder: { base: 1120, sm: 827, lg: 564 },
  },
  "weather-station": {
    component: lazy(() =>
      import("./weather-station-demo").then((m) => ({ default: m.WeatherStationDemo })),
    ),
    source: weatherStationSource,
    placeholder: { base: 870, sm: 910, md: 455, lg: 475 },
  },
  "serial-console": {
    component: lazy(() =>
      import("./serial-console-demo").then((m) => ({ default: m.SerialConsoleDemo })),
    ),
    source: serialConsoleSource,
    placeholder: { base: 334 },
  },
};

/** Rewrites repo import paths to the paths the shadcn CLI installs into a user's project. */
export function publicSource(source: string): string {
  return source
    .replaceAll(/@\/registry\/benchcn\/ui\/([\w-]+)\/[\w-]+/g, "@/components/ui/$1")
    .replaceAll(/@\/registry\/benchcn\/blocks\/([\w-]+)\/[\w-]+/g, "@/components/$1")
    .replaceAll("@/registry/benchcn/lib/", "@/lib/")
    .replaceAll("@/registry/benchcn/hooks/", "@/hooks/");
}
