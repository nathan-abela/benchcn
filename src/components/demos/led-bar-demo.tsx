import type { ReactElement, ReactNode } from "react";

import { useMockDevice } from "@/registry/benchcn/hooks/use-mock-device";
import { LedBar } from "@/registry/benchcn/ui/led-bar/led-bar";

function reading(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function format(value: number | undefined, digits: number, unit: string): string {
  return typeof value === "number" ? `${value.toFixed(digits)} ${unit}` : `-- ${unit}`;
}

export function LedBarDemo(): ReactElement {
  const { readings } = useMockDevice({ seed: 9, sampleInterval: 1000 });
  const soil = reading(readings.soil?.v);
  const battery = reading(readings.battery?.v);
  const humidity = reading(readings.humidity?.v);
  const temp = reading(readings.temp?.v);

  return (
    <div className="flex flex-wrap items-end gap-x-10 gap-y-6">
      <div className="flex flex-col gap-4">
        <Row label="Soil" value={format(soil, 0, "%")}>
          <LedBar
            label="Soil moisture"
            unit="%"
            value={soil}
            color="green"
            thresholds={{ low: 20, warnBelow: 30 }}
          />
        </Row>
        <Row label="Battery" value={format(battery, 2, "V")}>
          <LedBar
            label="Battery"
            unit="V"
            value={battery}
            min={3}
            max={4.2}
            segments={12}
            color="green"
            thresholds={{ low: 3.3, warnBelow: 3.5 }}
          />
        </Row>
        <Row label="Humidity" value={format(humidity, 0, "%")}>
          <LedBar label="Humidity" unit="%" value={humidity} mode="dot" color="blue" />
        </Row>
      </div>
      <div className="flex items-end gap-3">
        <LedBar
          label="Temperature"
          unit="°C"
          value={temp}
          max={40}
          thresholds={{ warnAbove: 28, high: 34 }}
          orientation="vertical"
        />
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs leading-none">Temp</span>
          <span className="text-sm leading-none font-medium tabular-nums">
            {format(temp, 1, "°C")}
          </span>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children: ReactNode;
}): ReactElement {
  return (
    <div className="flex items-center gap-3">
      <span className="text-muted-foreground w-16 text-xs">{label}</span>
      {children}
      <span className="text-sm font-medium tabular-nums">{value}</span>
    </div>
  );
}
