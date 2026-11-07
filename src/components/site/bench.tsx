import { type ReactElement, useMemo, useState } from "react";

import { useMockDevice } from "@/registry/benchcn/hooks/use-mock-device";
import { INITIAL_ACTUATOR_STATE } from "@/registry/benchcn/lib/actuator";
import type { WireSample } from "@/registry/benchcn/lib/wire";
import { ActuatorControl } from "@/registry/benchcn/ui/actuator-control/actuator-control";
import { CharacterLcd } from "@/registry/benchcn/ui/character-lcd/character-lcd";
import { Scope, type ScopeChannel } from "@/registry/benchcn/ui/oscilloscope/oscilloscope";
import { SensorTile } from "@/registry/benchcn/ui/sensor-tile/sensor-tile";
import { SevenSegment } from "@/registry/benchcn/ui/seven-segment/seven-segment";
import { StatusLed } from "@/registry/benchcn/ui/status-led/status-led";

const BUFFER = 8192;
const SAMPLE_RATE = 1_000_000;

function numberOf(sample: WireSample | undefined): number | null {
  return sample && typeof sample.v === "number" ? sample.v : null;
}

/** The hero: one mock device driving a scope, tiles, a pump, an LCD and LEDs, all at once. */
export function Bench(): ReactElement {
  const { device, readings, history, actuators, command, received } = useMockDevice({
    seed: 42,
    failSafe: { pump: false },
  });
  const [level, setLevel] = useState(0.2);
  const pump = actuators.pump ?? INITIAL_ACTUATOR_STATE;
  const soil = numberOf(readings.soil);
  const temp = numberOf(readings.temp);

  const channels = useMemo<ScopeChannel[]>(() => {
    const spanMs = (BUFFER / SAMPLE_RATE) * 1000;
    const pull = (ch: string) => () =>
      device.waveform(ch, Date.now() - spanMs, BUFFER, SAMPLE_RATE);
    return [
      { id: "ch1", label: "CH1", data: pull("ch1"), sampleRate: SAMPLE_RATE, voltsPerDiv: 0.5 },
      {
        id: "ch2",
        label: "CH2",
        data: pull("ch2"),
        sampleRate: SAMPLE_RATE,
        voltsPerDiv: 1,
        offset: -2.5,
      },
    ];
  }, [device]);

  return (
    <div data-slot="bench" className="grid min-w-0 gap-3 *:min-w-0 sm:grid-cols-6">
      <Scope.Root
        channels={channels}
        timebase={0.0002}
        trigger={{ source: "ch1", level }}
        onTriggerLevelChange={setLevel}
        className="bg-card rounded-xl border p-3 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.05),0_1px_2px_rgb(0_0_0/0.25)] sm:col-span-6"
      >
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground font-mono text-[11px] tracking-[0.12em] uppercase">
            Oscilloscope
          </span>
          <Scope.Status />
        </div>
        <Scope.Screen className="aspect-[16/7]" />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Scope.Readout />
          <Scope.Measurements
            items={["frequency", "peakToPeak"]}
            className="flex gap-6 sm:grid-cols-none"
          />
        </div>
      </Scope.Root>

      <SensorTile
        label="Soil moisture"
        value={soil}
        unit="%"
        precision={0}
        thresholds={{ min: 0, max: 100, low: 20, warnBelow: 30, warnAbove: 80 }}
        history={history.soil}
        className="sm:col-span-2"
      />
      <SensorTile
        label="Air temperature"
        value={temp}
        unit="°C"
        thresholds={{ min: 0, max: 40, warnBelow: 12, warnAbove: 30 }}
        history={history.temp}
        className="sm:col-span-2"
      />
      <ActuatorControl
        label="Water pump"
        description="Fail-safe off"
        {...pump}
        onCommand={(next) => command("pump", next)}
        className="sm:col-span-2"
      />

      <div className="bg-card flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.05),0_1px_2px_rgb(0_0_0/0.25)] sm:col-span-6">
        <SevenSegment
          value={temp === null ? "--.-" : temp}
          decimals={1}
          digits={3}
          color="red"
          size={30}
          label={`Temperature ${temp} degrees`}
        />
        <CharacterLcd
          lines={[
            `SOIL ${soil === null ? "--" : soil.toFixed(0).padStart(2)}% PUMP ${pump.confirmed ? "ON" : "--"}`,
            `${temp === null ? "--.-" : temp.toFixed(1)}°C   benchcn`,
          ]}
          scale={2.2}
          className="hidden md:inline-block"
        />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <StatusLed label="Power" color="green" size="sm" showLabel />
          <StatusLed
            label="Link"
            color="blue"
            size="sm"
            pattern="heartbeat"
            rate={1}
            on={received > 0}
            showLabel
          />
          <StatusLed label="Pump" color="amber" size="sm" on={pump.confirmed === true} showLabel />
        </div>
      </div>
    </div>
  );
}
