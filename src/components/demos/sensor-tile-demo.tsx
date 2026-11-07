import { type ReactElement, useState } from "react";

import { useMockDevice } from "@/registry/benchcn/hooks/use-mock-device";
import type { WireSample } from "@/registry/benchcn/lib/wire";
import { SensorTile } from "@/registry/benchcn/ui/sensor-tile/sensor-tile";

export function SensorTileDemo(): ReactElement {
  const { readings, history } = useMockDevice({ seed: 2, sampleInterval: 1000 });
  const [staleSince] = useState(() => Date.now() - 42_000);
  const temp = readings.temp;
  const humidity = readings.humidity;
  const soil = readings.soil;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <SensorTile
        label="Air temperature"
        value={numberOf(temp)}
        unit="°C"
        thresholds={{ min: 0, max: 40, warnBelow: 10, warnAbove: 28, low: 2, high: 35 }}
        history={history.temp}
        updatedAt={timeOf(temp)}
      />
      <SensorTile
        label="Humidity"
        value={numberOf(humidity)}
        unit="%"
        precision={0}
        thresholds={{ min: 0, max: 100, warnBelow: 30, warnAbove: 70 }}
        history={history.humidity}
        updatedAt={timeOf(humidity)}
      />
      <SensorTile
        label="Soil moisture"
        value={numberOf(soil)}
        unit="%"
        precision={0}
        thresholds={{ min: 0, max: 100, low: 20, warnBelow: 30, warnAbove: 80 }}
        history={history.soil}
        updatedAt={timeOf(soil)}
      />
      <SensorTile label="Pressure" value={1013.2} unit="hPa" precision={1} updatedAt={staleSince} />
      <SensorTile label="CO₂" value={null} unit="ppm" />
      <SensorTile
        label="Battery"
        value={3.41}
        unit="V"
        precision={2}
        thresholds={{ min: 3, max: 4.2, low: 3.3, warnBelow: 3.5 }}
      />
    </div>
  );
}

function numberOf(sample: WireSample | undefined): number | null {
  return sample && typeof sample.v === "number" ? sample.v : null;
}

function timeOf(sample: WireSample | undefined): number | undefined {
  return sample?.t === undefined ? undefined : sample.t * 1000;
}
