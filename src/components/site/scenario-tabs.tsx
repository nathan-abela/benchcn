import { motion, useReducedMotion } from "motion/react";
import { lazy, type ReactElement, Suspense, useState } from "react";

import { Placeholder, type PlaceholderHeights } from "@/components/site/placeholder";
import { cn } from "@/lib/utils";
import { PowerBench } from "@/registry/benchcn/blocks/power-bench/power-bench";
import { useMockDevice } from "@/registry/benchcn/hooks/use-mock-device";
import { INITIAL_ACTUATOR_STATE } from "@/registry/benchcn/lib/actuator";
import type { WireSample } from "@/registry/benchcn/lib/wire";
import { ActuatorControl } from "@/registry/benchcn/ui/actuator-control/actuator-control";
import { SensorTile } from "@/registry/benchcn/ui/sensor-tile/sensor-tile";
import { SerialConsole } from "@/registry/benchcn/ui/serial-console/serial-console";
import { StatusLed } from "@/registry/benchcn/ui/status-led/status-led";

// The default scenario is imported statically: a lazy component in the first render suspends the
// prerender, and the late streamed chunk lands after </html>. The rest load on first selection.
const PlantMonitor = lazy(() =>
  import("@/registry/benchcn/blocks/plant-monitor/plant-monitor").then((m) => ({
    default: m.PlantMonitor,
  })),
);
const WeatherStation = lazy(() =>
  import("@/registry/benchcn/blocks/weather-station/weather-station").then((m) => ({
    default: m.WeatherStation,
  })),
);
const OscilloscopeDemo = lazy(() =>
  import("@/components/demos/oscilloscope-demo").then((m) => ({ default: m.OscilloscopeDemo })),
);
const LogicAnalyzerDemo = lazy(() =>
  import("@/components/demos/logic-analyzer-demo").then((m) => ({ default: m.LogicAnalyzerDemo })),
);
const PinoutHeaderDemo = lazy(() =>
  import("@/components/demos/pinout-header-demo").then((m) => ({ default: m.PinoutHeaderDemo })),
);
const BitfieldDiagramDemo = lazy(() =>
  import("@/components/demos/bitfield-diagram-demo").then((m) => ({
    default: m.BitfieldDiagramDemo,
  })),
);
const TimingDiagramDemo = lazy(() =>
  import("@/components/demos/timing-diagram-demo").then((m) => ({ default: m.TimingDiagramDemo })),
);

const SCENARIOS = [
  {
    id: "power",
    label: "Power bench",
    blurb: "Confirmed setpoints, CV and CC, a meter at the load and the log.",
  },
  { id: "plant", label: "Plant monitor", blurb: "Soil, climate, a pump and its acknowledgements." },
  {
    id: "weather",
    label: "Weather station",
    blurb: "Climate tiles, dew point and pressure trend.",
  },
  { id: "signals", label: "Signals", blurb: "Scope and logic analyzer on the same mock signals." },
  { id: "robot", label: "Robot", blurb: "Drive enable, e-stop, battery and a console." },
  { id: "datasheet", label: "Datasheet", blurb: "Pinout, register map and timing figures." },
] as const;

type ScenarioId = (typeof SCENARIOS)[number]["id"];

function numberOf(sample: WireSample | undefined): number | null {
  return sample && typeof sample.v === "number" ? sample.v : null;
}

function Robot(): ReactElement {
  const { readings, history, actuators, logs, command, received } = useMockDevice({
    seed: 77,
    failSafe: { pump: false, led: false },
  });
  const drive = actuators.pump ?? INITIAL_ACTUATOR_STATE;
  const estop = actuators.led ?? INITIAL_ACTUATOR_STATE;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <ActuatorControl
        label="Drive enable"
        description="Motor controller enable · fail-safe off"
        {...drive}
        onCommand={(next) => command("pump", next)}
      />
      <ActuatorControl
        label="Emergency stop"
        description="Latching · tap to toggle"
        holdMs={0}
        labels={{ on: "Engaged", off: "Clear" }}
        {...estop}
        onCommand={(next) => command("led", next)}
      />
      <div className="flex flex-col gap-4">
        <SensorTile
          label="Battery"
          value={numberOf(readings.battery)}
          unit="V"
          precision={2}
          thresholds={{ min: 3, max: 4.2, low: 3.3, warnBelow: 3.5 }}
          history={history.battery}
        />
        <div className="bg-card flex items-center justify-around rounded-xl border p-3">
          <StatusLed
            label="Link"
            color="blue"
            pattern="heartbeat"
            rate={1}
            on={received > 0}
            showLabel
          />
          <StatusLed label="Drive" color="green" on={drive.confirmed === true} showLabel />
          <StatusLed
            label="E-stop"
            color="red"
            pattern="blink"
            on={estop.confirmed === true}
            showLabel
          />
        </div>
      </div>
      <SerialConsole
        lines={logs.map((log, i) => ({ id: i, text: log.log, level: log.lvl, t: log.t }))}
        height={160}
        className="lg:col-span-3"
      />
    </div>
  );
}

const PLACEHOLDERS: Record<ScenarioId, PlaceholderHeights> = {
  power: { base: 1802, sm: 1422, md: 1216, lg: 1178, xl: 1012 },
  plant: { base: 1103, sm: 831, lg: 566 },
  weather: { base: 880, sm: 916, md: 475 },
  signals: { base: 1034, md: 1196, lg: 1086, xl: 1273 },
  robot: { base: 816, lg: 472, xl: 416 },
  datasheet: { base: 2057, lg: 1477, xl: 1461 },
};

export function ScenarioTabs(): ReactElement {
  const [active, setActive] = useState<ScenarioId>("power");
  const reduced = useReducedMotion();
  const scenario = SCENARIOS.find((s) => s.id === active) ?? SCENARIOS[0];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div role="tablist" aria-label="Scenarios" className="flex flex-wrap gap-1">
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={active === s.id}
              onClick={() => setActive(s.id)}
              className={cn(
                "focus-visible:ring-ring/50 relative isolate rounded-full px-3 py-1.5 text-sm transition-[color,transform] duration-150 ease-out outline-none focus-visible:ring-[3px] active:scale-[0.97]",
                active === s.id
                  ? "text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent",
              )}
            >
              {active === s.id ? (
                <motion.span
                  layoutId="scenario-pill"
                  aria-hidden
                  className="bg-primary absolute inset-0 -z-10 rounded-full"
                  transition={
                    reduced ? { duration: 0 } : { type: "spring", duration: 0.35, bounce: 0 }
                  }
                />
              ) : null}
              {s.label}
            </button>
          ))}
        </div>
        <p className="text-muted-foreground text-sm">{scenario.blurb}</p>
      </div>
      <div role="tabpanel" className="min-h-72">
        <Suspense fallback={<Placeholder heights={PLACEHOLDERS[active]} />}>
          <div key={active} className="rise-in">
            {active === "power" ? <PowerBench key="power" /> : null}
            {active === "plant" ? <PlantMonitor key="plant" /> : null}
            {active === "weather" ? <WeatherStation key="weather" /> : null}
            {active === "signals" ? (
              <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
                <OscilloscopeDemo />
                <div className="lg:col-span-2">
                  <LogicAnalyzerDemo />
                </div>
              </div>
            ) : null}
            {active === "robot" ? <Robot key="robot" /> : null}
            {active === "datasheet" ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="lg:col-span-2">
                  <PinoutHeaderDemo />
                </div>
                <BitfieldDiagramDemo />
                <TimingDiagramDemo />
              </div>
            ) : null}
          </div>
        </Suspense>
      </div>
    </div>
  );
}
