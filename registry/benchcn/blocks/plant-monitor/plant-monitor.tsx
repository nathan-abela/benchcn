// benchcn.dev · plant-monitor
// A complete plant dashboard: soil, climate and light tiles, a pump with commanded-versus-confirmed
// state, a status LCD, link LEDs and a console. Runs on the mock device until you pass a source.
import type { ComponentProps, ReactElement } from "react";

import { cn } from "@/lib/utils";
import { useMockDevice } from "@/registry/benchcn/hooks/use-mock-device";
import { INITIAL_ACTUATOR_STATE } from "@/registry/benchcn/lib/actuator";
import { InstrumentLabel } from "@/registry/benchcn/lib/instrument";
import type { SourceHandle } from "@/registry/benchcn/lib/source-store";
import type { WireSample } from "@/registry/benchcn/lib/wire";
import { ActuatorControl } from "@/registry/benchcn/ui/actuator-control/actuator-control";
import { CharacterLcd } from "@/registry/benchcn/ui/character-lcd/character-lcd";
import { SensorTile } from "@/registry/benchcn/ui/sensor-tile/sensor-tile";
import { SerialConsole } from "@/registry/benchcn/ui/serial-console/serial-console";
import { StatusLed } from "@/registry/benchcn/ui/status-led/status-led";

export type PlantMonitorProps = ComponentProps<"section"> & {
  /** Any source handle. Without one the block runs its own mock device. */
  source?: SourceHandle;
  title?: string;
  /** `kiosk` fills an 800×480 touchscreen with larger targets and no console. */
  layout?: "grid" | "kiosk";
  /** Channel ids, if your device names them differently. */
  channels?: Partial<typeof DEFAULT_CHANNELS>;
};

const DEFAULT_CHANNELS = {
  soil: "soil",
  temp: "temp",
  humidity: "humidity",
  light: "light",
  pump: "pump",
};

const DROP = [0b00100, 0b00100, 0b01010, 0b01010, 0b10001, 0b10001, 0b10001, 0b01110];

export function PlantMonitor({ source, ...props }: PlantMonitorProps): ReactElement {
  return source ? <Panel source={source} {...props} /> : <MockPanel {...props} />;
}

function MockPanel(props: Omit<PlantMonitorProps, "source">): ReactElement {
  const source = useMockDevice({ seed: 21, failSafe: { pump: false } });
  return <Panel source={source} {...props} />;
}

function numberOf(sample: WireSample | undefined): number | null {
  return sample && typeof sample.v === "number" ? sample.v : null;
}

function timeOf(sample: WireSample | undefined): number | undefined {
  return sample?.t === undefined ? undefined : sample.t * 1000;
}

function Panel({
  source,
  title = "Plant monitor",
  layout = "grid",
  channels: overrides,
  className,
  ...props
}: Omit<PlantMonitorProps, "source"> & { source: SourceHandle }): ReactElement {
  const ch = { ...DEFAULT_CHANNELS, ...overrides };
  const { readings, history, actuators, logs, command, received } = source;
  const soil = readings[ch.soil];
  const temp = readings[ch.temp];
  const humidity = readings[ch.humidity];
  const light = readings[ch.light];
  const pump = actuators[ch.pump] ?? INITIAL_ACTUATOR_STATE;
  const kiosk = layout === "kiosk";

  const soilValue = numberOf(soil);
  const lcdTop = `\u0001 ${soilValue === null ? "--" : soilValue.toFixed(0).padStart(2)}%  PUMP ${pump.confirmed ? "ON " : "OFF"}`;
  const tempValue = numberOf(temp);
  const lcdBottom = `${tempValue === null ? "--.-" : tempValue.toFixed(1)}°C ${
    numberOf(humidity) === null ? "--" : numberOf(humidity)!.toFixed(0)
  }%RH`;

  return (
    <section
      data-slot="plant-monitor"
      data-layout={layout}
      className={cn(
        "bg-background text-foreground flex flex-col gap-4",
        kiosk && "h-[480px] w-[800px] overflow-hidden p-4",
        className,
      )}
      {...props}
    >
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <InstrumentLabel>{title}</InstrumentLabel>
        </div>
        <div className="flex items-center gap-4">
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
      </header>

      <div className={cn("grid gap-4", kiosk ? "grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4")}>
        <SensorTile
          label="Soil moisture"
          value={soilValue}
          unit="%"
          precision={0}
          thresholds={{ min: 0, max: 100, low: 20, warnBelow: 30, warnAbove: 80, high: 90 }}
          history={history[ch.soil]}
          updatedAt={timeOf(soil)}
        />
        <SensorTile
          label="Air temperature"
          value={tempValue}
          unit={temp?.u ?? "°C"}
          thresholds={{ min: 0, max: 40, warnBelow: 12, warnAbove: 30 }}
          history={history[ch.temp]}
          updatedAt={timeOf(temp)}
        />
        <SensorTile
          label="Humidity"
          value={numberOf(humidity)}
          unit="%"
          precision={0}
          thresholds={{ min: 0, max: 100, warnBelow: 30, warnAbove: 75 }}
          history={history[ch.humidity]}
          updatedAt={timeOf(humidity)}
        />
        {kiosk ? (
          <ActuatorControl
            label="Water pump"
            description="Fail-safe off · 2 s timeout"
            {...pump}
            onCommand={(next) => command(ch.pump, next)}
            className="col-span-2"
          />
        ) : null}
        <SensorTile
          label="Light"
          value={numberOf(light)}
          unit="lx"
          precision={0}
          thresholds={{ min: 0, max: 20_000 }}
          history={history[ch.light]}
          updatedAt={timeOf(light)}
        />
      </div>

      {kiosk ? null : (
        <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
          <ActuatorControl
            label="Water pump"
            description="Relay on GPIO 17 · fail-safe off · 2 s timeout"
            {...pump}
            onCommand={(next) => command(ch.pump, next)}
          />
          <div className="bg-card flex items-center justify-center rounded-xl border p-4">
            <CharacterLcd
              lines={[lcdTop, lcdBottom]}
              customGlyphs={{ "\u0001": DROP }}
              label={`Soil ${soilValue} percent, pump ${pump.confirmed ? "on" : "off"}`}
            />
          </div>
        </div>
      )}

      {kiosk ? null : (
        <SerialConsole
          lines={logs.map((log, i) => ({ id: i, text: log.log, level: log.lvl, t: log.t }))}
          height={140}
          status={`${received} msgs`}
        />
      )}
    </section>
  );
}
