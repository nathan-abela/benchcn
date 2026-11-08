// benchcn.dev · weather-station
// A weather station dashboard: a big seven-segment temperature, climate tiles with sparklines, a
// computed dew point, pressure trend on an LCD and a low-battery LED. Mock device until you pass a
// source.
import type { ComponentProps, ReactElement } from "react";

import { cn } from "@/lib/utils";
import { useMockDevice } from "@/registry/benchcn/hooks/use-mock-device";
import { InstrumentLabel } from "@/registry/benchcn/lib/instrument";
import type { SourceHandle } from "@/registry/benchcn/lib/source-store";
import type { WireSample } from "@/registry/benchcn/lib/wire";
import { CharacterLcd } from "@/registry/benchcn/ui/character-lcd/character-lcd";
import { SensorTile } from "@/registry/benchcn/ui/sensor-tile/sensor-tile";
import { SevenSegment } from "@/registry/benchcn/ui/seven-segment/seven-segment";
import { StatusLed } from "@/registry/benchcn/ui/status-led/status-led";

export type WeatherStationProps = ComponentProps<"section"> & {
  source?: SourceHandle;
  title?: string;
  layout?: "grid" | "kiosk";
  channels?: Partial<typeof DEFAULT_CHANNELS>;
};

const DEFAULT_CHANNELS = {
  temp: "temp",
  humidity: "humidity",
  pressure: "pressure",
  light: "light",
  battery: "battery",
};

/** Magnus formula with the Sonntag constants; good to about 0.35 °C between -45 and 60 °C. */
export function dewPoint(tempC: number, relativeHumidity: number): number {
  const a = 17.62;
  const b = 243.12;
  const gamma = Math.log(Math.max(1, relativeHumidity) / 100) + (a * tempC) / (b + tempC);
  return (b * gamma) / (a - gamma);
}

export function pressureTrend(history: number[] | undefined): "rising" | "falling" | "steady" {
  if (!history || history.length < 4) return "steady";
  const delta = history[history.length - 1] - history[0];
  if (delta > 0.5) return "rising";
  if (delta < -0.5) return "falling";
  return "steady";
}

export function WeatherStation({ source, ...props }: WeatherStationProps): ReactElement {
  return source ? <Panel source={source} {...props} /> : <MockPanel {...props} />;
}

function MockPanel(props: Omit<WeatherStationProps, "source">): ReactElement {
  const source = useMockDevice({ seed: 34 });
  return <Panel source={source} {...props} />;
}

function numberOf(sample: WireSample | undefined): number | null {
  return sample && typeof sample.v === "number" ? sample.v : null;
}

function timeOf(sample: WireSample | undefined): number | undefined {
  return sample?.t === undefined ? undefined : sample.t * 1000;
}

const TREND_ARROW = { rising: "→ rising", falling: "← falling", steady: "  steady" };

function Panel({
  source,
  title = "Weather station",
  layout = "grid",
  channels: overrides,
  className,
  ...props
}: Omit<WeatherStationProps, "source"> & { source: SourceHandle }): ReactElement {
  const ch = { ...DEFAULT_CHANNELS, ...overrides };
  const { readings, history, received } = source;
  const temp = numberOf(readings[ch.temp]);
  const humidity = numberOf(readings[ch.humidity]);
  const pressure = numberOf(readings[ch.pressure]);
  const light = numberOf(readings[ch.light]);
  const battery = numberOf(readings[ch.battery]);
  const dew = temp !== null && humidity !== null ? dewPoint(temp, humidity) : null;
  const trend = pressureTrend(history[ch.pressure]);
  const kiosk = layout === "kiosk";

  return (
    <section
      data-slot="weather-station"
      data-layout={layout}
      className={cn(
        "bg-background text-foreground flex flex-col gap-4",
        kiosk && "h-[480px] w-[800px] overflow-hidden p-4",
        className,
      )}
      {...props}
    >
      <header className="flex items-center justify-between gap-4">
        <InstrumentLabel>{title}</InstrumentLabel>
        <div className="flex items-center gap-4">
          <StatusLed
            label="Link"
            color="blue"
            size="sm"
            pattern="heartbeat"
            rate={1}
            on={received > 0}
            showLabel
          />
          <StatusLed
            label="Battery"
            color="red"
            size="sm"
            pattern="blink"
            on={battery !== null && battery < 3.5}
            showLabel
          />
        </div>
      </header>

      <div className={cn("grid gap-4", kiosk ? "grid-cols-3" : "md:grid-cols-3")}>
        <div className="bg-card flex flex-col items-center justify-center gap-3 rounded-xl border p-4 md:row-span-2">
          <InstrumentLabel>Outside</InstrumentLabel>
          <SevenSegment
            value={temp === null ? "--.-" : temp}
            decimals={1}
            digits={3}
            color="red"
            size={kiosk ? 56 : 64}
            label={`Outside temperature ${temp} degrees`}
          />
          <span className="text-muted-foreground font-mono text-xs">
            dew point {dew === null ? "--" : `${dew.toFixed(1)} °C`}
          </span>
        </div>
        <SensorTile
          label="Temperature"
          value={temp}
          unit="°C"
          thresholds={{ min: -10, max: 40, warnBelow: 0, warnAbove: 30 }}
          history={history[ch.temp]}
          updatedAt={timeOf(readings[ch.temp])}
        />
        <SensorTile
          label="Humidity"
          value={humidity}
          unit="%"
          precision={0}
          thresholds={{ min: 0, max: 100, warnBelow: 25, warnAbove: 80 }}
          history={history[ch.humidity]}
          updatedAt={timeOf(readings[ch.humidity])}
        />
        <SensorTile
          label="Pressure"
          value={pressure}
          unit="hPa"
          precision={1}
          thresholds={{ min: 960, max: 1050 }}
          history={history[ch.pressure]}
          updatedAt={timeOf(readings[ch.pressure])}
        />
        <SensorTile
          label="Light"
          value={light}
          unit="lx"
          precision={0}
          thresholds={{ min: 0, max: 20_000 }}
          history={history[ch.light]}
          updatedAt={timeOf(readings[ch.light])}
        />
      </div>

      <div className="bg-card flex items-center justify-center rounded-xl border p-4">
        <CharacterLcd
          color="blue"
          lines={[
            `${temp === null ? "--.-" : temp.toFixed(1).padStart(5)}°C  ${
              humidity === null ? "--" : humidity.toFixed(0).padStart(2)
            }%RH`,
            `${pressure === null ? "----" : pressure.toFixed(0)}hPa ${TREND_ARROW[trend]}`,
          ]}
          scale={kiosk ? 2.5 : 3}
        />
      </div>
    </section>
  );
}
