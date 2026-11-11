import { motion, useReducedMotion } from "motion/react";
import { lazy, type ReactElement, Suspense, useState } from "react";

import { Placeholder, type PlaceholderHeights } from "@/components/site/placeholder";
import { cn } from "@/lib/utils";
import { PowerBench } from "@/registry/benchcn/blocks/power-bench/power-bench";

// The default scenario is imported statically: a lazy component in the first render suspends the
// prerender, and the late streamed chunk lands after </html>. The rest load on first selection.
const PlantMonitor = lazy(() =>
  import("@/registry/benchcn/blocks/plant-monitor/plant-monitor").then((m) => ({
    default: m.PlantMonitor,
  })),
);
const Robot = lazy(() =>
  import("@/registry/benchcn/blocks/robot/robot").then((m) => ({ default: m.Robot })),
);
const WeatherStation = lazy(() =>
  import("@/registry/benchcn/blocks/weather-station/weather-station").then((m) => ({
    default: m.WeatherStation,
  })),
);
const SignalsBench = lazy(() =>
  import("@/components/site/signals-bench").then((m) => ({ default: m.SignalsBench })),
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
  { id: "signals", label: "Signals", blurb: "A triggered scope, a decoded bus and a slow trend." },
  {
    id: "robot",
    label: "Robot",
    blurb: "An e-stop that wins, a joystick, odometry and a watchdog.",
  },
  { id: "datasheet", label: "Datasheet", blurb: "Pinout, register map and timing figures." },
] as const;

type ScenarioId = (typeof SCENARIOS)[number]["id"];

const PLACEHOLDERS: Record<ScenarioId, PlaceholderHeights> = {
  power: { base: 1802, sm: 1422, md: 1216, lg: 1178, xl: 1012 },
  plant: { base: 1103, sm: 831, lg: 566 },
  weather: { base: 880, sm: 916, md: 475 },
  signals: { base: 1228, sm: 1354, md: 1391, lg: 673, xl: 735 },
  robot: { base: 2020, sm: 2321, md: 2027, lg: 2227, xl: 979 },
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
            {active === "signals" ? <SignalsBench /> : null}
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
