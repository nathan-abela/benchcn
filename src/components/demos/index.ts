import { type ComponentType, lazy } from "react";

import actuatorControlSource from "./actuator-control-demo.tsx?raw";
import bitfieldDiagramSource from "./bitfield-diagram-demo.tsx?raw";
import characterLcdSource from "./character-lcd-demo.tsx?raw";
import logicAnalyzerSource from "./logic-analyzer-demo.tsx?raw";
import oscilloscopeSource from "./oscilloscope-demo.tsx?raw";
import pinoutHeaderSource from "./pinout-header-demo.tsx?raw";
import sensorTileSource from "./sensor-tile-demo.tsx?raw";
import serialConsoleSource from "./serial-console-demo.tsx?raw";
import sevenSegmentSource from "./seven-segment-demo.tsx?raw";
import statusLedSource from "./status-led-demo.tsx?raw";
import timingDiagramSource from "./timing-diagram-demo.tsx?raw";

export type Demo = {
  component: ComponentType;
  source: string;
};

export const demos: Record<string, Demo> = {
  oscilloscope: {
    component: lazy(() =>
      import("./oscilloscope-demo").then((m) => ({ default: m.OscilloscopeDemo })),
    ),
    source: oscilloscopeSource,
  },
  "logic-analyzer": {
    component: lazy(() =>
      import("./logic-analyzer-demo").then((m) => ({ default: m.LogicAnalyzerDemo })),
    ),
    source: logicAnalyzerSource,
  },
  "actuator-control": {
    component: lazy(() =>
      import("./actuator-control-demo").then((m) => ({ default: m.ActuatorControlDemo })),
    ),
    source: actuatorControlSource,
  },
  "status-led": {
    component: lazy(() => import("./status-led-demo").then((m) => ({ default: m.StatusLedDemo }))),
    source: statusLedSource,
  },
  "seven-segment": {
    component: lazy(() =>
      import("./seven-segment-demo").then((m) => ({ default: m.SevenSegmentDemo })),
    ),
    source: sevenSegmentSource,
  },
  "sensor-tile": {
    component: lazy(() =>
      import("./sensor-tile-demo").then((m) => ({ default: m.SensorTileDemo })),
    ),
    source: sensorTileSource,
  },
  "character-lcd": {
    component: lazy(() =>
      import("./character-lcd-demo").then((m) => ({ default: m.CharacterLcdDemo })),
    ),
    source: characterLcdSource,
  },
  "pinout-header": {
    component: lazy(() =>
      import("./pinout-header-demo").then((m) => ({ default: m.PinoutHeaderDemo })),
    ),
    source: pinoutHeaderSource,
  },
  "bitfield-diagram": {
    component: lazy(() =>
      import("./bitfield-diagram-demo").then((m) => ({ default: m.BitfieldDiagramDemo })),
    ),
    source: bitfieldDiagramSource,
  },
  "timing-diagram": {
    component: lazy(() =>
      import("./timing-diagram-demo").then((m) => ({ default: m.TimingDiagramDemo })),
    ),
    source: timingDiagramSource,
  },
  "serial-console": {
    component: lazy(() =>
      import("./serial-console-demo").then((m) => ({ default: m.SerialConsoleDemo })),
    ),
    source: serialConsoleSource,
  },
};

/** Rewrites repo import paths to the paths the shadcn CLI installs into a user's project. */
export function publicSource(source: string): string {
  return source
    .replaceAll(/@\/registry\/benchcn\/ui\/([\w-]+)\/[\w-]+/g, "@/components/ui/$1")
    .replaceAll("@/registry/benchcn/lib/", "@/lib/")
    .replaceAll("@/registry/benchcn/hooks/", "@/hooks/");
}
