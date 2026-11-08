import { type ReactElement, useMemo, useState } from "react";

import { useClock } from "@/components/demos/use-clock";
import { useMockDevice } from "@/registry/benchcn/hooks/use-mock-device";
import { INITIAL_ACTUATOR_STATE } from "@/registry/benchcn/lib/actuator";
import { encodeI2c, type I2cTransaction } from "@/registry/benchcn/lib/decoders/i2c";
import { createMockDevice, createRandom } from "@/registry/benchcn/lib/mock-device";
import type { WireSample } from "@/registry/benchcn/lib/wire";
import { ActuatorControl } from "@/registry/benchcn/ui/actuator-control/actuator-control";
import { CharacterLcd } from "@/registry/benchcn/ui/character-lcd/character-lcd";
import { LogicAnalyzer, type LogicLane } from "@/registry/benchcn/ui/logic-analyzer/logic-analyzer";
import { Scope, type ScopeChannel } from "@/registry/benchcn/ui/oscilloscope/oscilloscope";
import { SevenSegment } from "@/registry/benchcn/ui/seven-segment/seven-segment";
import { StatusLed } from "@/registry/benchcn/ui/status-led/status-led";

const BUFFER = 8192;
const SAMPLE_RATE = 1_000_000;
const I2C_SAMPLE_RATE = 1_000_000;

const THERMOMETER = [0b00100, 0b01010, 0b01010, 0b01110, 0b01110, 0b11111, 0b11111, 0b01110];
const DROP = [0b00100, 0b00100, 0b01010, 0b01010, 0b10001, 0b10001, 0b10001, 0b01110];

function numberOf(sample: WireSample | undefined): number | null {
  return sample && typeof sample.v === "number" ? sample.v : null;
}

function bme280Burst(rand: () => number): I2cTransaction[] {
  const bytes = Array.from({ length: 8 }, () => Math.floor(rand() * 256));
  return [
    { address: 0x76, read: false, data: [0xf7] },
    { address: 0x76, read: true, data: bytes, repeatedStart: true },
  ];
}

function i2cLanes(seed: number): LogicLane[] {
  const rand = createRandom(seed);
  const trace = encodeI2c(
    [
      ...bme280Burst(rand),
      { address: 0x3c, read: false, data: [0x00, 0xae] },
      { address: 0x48, read: false, data: [0x01, 0xc3, 0x83] },
      ...bme280Burst(rand),
    ],
    { sampleRate: I2C_SAMPLE_RATE, clockHz: 100_000 },
  );
  return [
    { id: "scl", label: "SCL", data: trace.scl, sampleRate: I2C_SAMPLE_RATE },
    { id: "sda", label: "SDA", data: trace.sda, sampleRate: I2C_SAMPLE_RATE },
  ];
}

function BenchScope(): ReactElement {
  const device = useMemo(() => createMockDevice({ seed: 7 }), []);
  const [level, setLevel] = useState(0.2);
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
    <Scope.Root
      channels={channels}
      timebase={0.0002}
      trigger={{ source: "ch1", level }}
      onTriggerLevelChange={setLevel}
      className="bg-card rise-in flex flex-col gap-3 rounded-xl border p-3 [--rise-delay:200ms] lg:col-span-7"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Oscilloscope</span>
        <Scope.Status />
      </div>
      <Scope.Screen className="aspect-[16/7]" />
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <Scope.Readout />
        <Scope.Measurements
          items={["frequency", "peakToPeak", "rms"]}
          className="flex gap-6 sm:grid-cols-none"
        />
      </div>
    </Scope.Root>
  );
}

/** The opening bench: the two signature instruments, the emissive displays and the pump. */
export function Bench(): ReactElement {
  const { readings, actuators, command, received } = useMockDevice({
    seed: 42,
    failSafe: { pump: false },
  });
  const clock = useClock();
  const lanes = useMemo(() => i2cLanes(1), []);

  const pump = actuators.pump ?? INITIAL_ACTUATOR_STATE;
  const soil = numberOf(readings.soil);
  const temp = numberOf(readings.temp);
  const humidity = numberOf(readings.humidity);
  const battery = numberOf(readings.battery);

  return (
    <div data-slot="bench" className="grid gap-3 *:min-w-0 lg:grid-cols-12">
      <BenchScope />

      <LogicAnalyzer
        lanes={lanes}
        decode={{ protocol: "i2c", sda: "sda", scl: "scl" }}
        title="Logic analyzer"
        defaultWindow="first"
        laneHeight={44}
        className="rise-in [--rise-delay:260ms] lg:col-span-5"
      />

      <div className="bg-card rise-in flex flex-col justify-between gap-5 rounded-xl border p-3 [--rise-delay:320ms] lg:col-span-4">
        <span className="text-sm font-medium">Front panel</span>
        <SevenSegment
          value={clock.time}
          colon={clock.colon}
          color="amber"
          size={56}
          label="Clock"
        />
        <div className="flex flex-wrap items-end gap-4">
          <SevenSegment
            value={temp ?? "--.-"}
            decimals={1}
            digits={3}
            color="red"
            size={28}
            label={`Temperature ${temp} degrees`}
          />
          <SevenSegment
            value={battery ?? "-.--"}
            decimals={2}
            digits={3}
            color="green"
            size={28}
            label={`Battery ${battery} volts`}
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <StatusLed label="Power" color="green" showLabel />
          <StatusLed
            label="Link"
            color="blue"
            pattern="heartbeat"
            rate={1}
            on={received > 0}
            showLabel
          />
          <StatusLed label="Pump" color="amber" on={pump.confirmed === true} showLabel />
          <StatusLed
            label="Battery"
            color="red"
            pattern="blink"
            rate={2}
            on={battery !== null && battery < 3.5}
            showLabel
          />
        </div>
      </div>

      <div className="bg-card rise-in flex flex-col gap-4 rounded-xl border p-3 [--rise-delay:380ms] lg:col-span-4">
        <span className="text-sm font-medium">Character LCD</span>
        <div className="flex flex-col items-start gap-4">
          <CharacterLcd
            lines={[
              ` ${temp === null ? "--.-" : temp.toFixed(1)}°C`.padEnd(16),
              ` ${humidity === null ? "--" : humidity.toFixed(0)}% RH`.padEnd(16),
            ]}
            customGlyphs={{ "": THERMOMETER, "": DROP }}
            scale={3}
            label={`Temperature ${temp} degrees, humidity ${humidity} percent`}
          />
          <CharacterLcd
            lines={[
              `PUMP ${pump.confirmed ? "ON " : "OFF"}  ${clock.time}`,
              `SOIL ${soil === null ? "--" : soil.toFixed(0)}%`,
            ]}
            color="amber"
            scale={3}
          />
        </div>
      </div>

      <ActuatorControl
        label="Water pump"
        description="Fail-safe off"
        {...pump}
        onCommand={(next) => command("pump", next)}
        className="rise-in [--rise-delay:440ms] lg:col-span-4"
      />
    </div>
  );
}
