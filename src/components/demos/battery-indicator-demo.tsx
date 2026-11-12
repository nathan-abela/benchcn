import type { ReactElement } from "react";

import { useMockDevice } from "@/registry/benchcn/hooks/use-mock-device";
import { BatteryIndicator } from "@/registry/benchcn/ui/battery-indicator/battery-indicator";

export function BatteryIndicatorDemo(): ReactElement {
  const { readings } = useMockDevice({ seed: 2 });
  const battery = readings.battery?.v;

  return (
    <div className="flex flex-col items-start gap-6">
      <BatteryIndicator
        className="text-2xl"
        label="Sensor node battery"
        unit="V"
        min={3.0}
        max={4.2}
        value={typeof battery === "number" ? battery : null}
      />
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        <BatteryIndicator value={100} charging />
        <BatteryIndicator value={64} />
        <BatteryIndicator value={17} />
        <BatteryIndicator value={6} />
        <BatteryIndicator value={null} />
      </div>
    </div>
  );
}
