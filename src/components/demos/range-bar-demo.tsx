import type { ReactElement } from "react";

import { Button } from "@/components/ui/button";
import { useMockDevice } from "@/registry/benchcn/hooks/use-mock-device";
import { INITIAL_ACTUATOR_STATE } from "@/registry/benchcn/lib/actuator";
import type { WireSample } from "@/registry/benchcn/lib/wire";
import { RangeBar } from "@/registry/benchcn/ui/range-bar/range-bar";

const TARGETS = [20, 32, 36];

export function RangeBarDemo(): ReactElement {
  const { readings, history, setpoints, command } = useMockDevice({ seed: 8, sampleInterval: 500 });
  const heater = setpoints.heater ?? INITIAL_ACTUATOR_STATE;

  return (
    <div className="flex flex-wrap items-start gap-4">
      <RangeBar
        className="min-w-0 flex-1 basis-72"
        label="Chamber temperature"
        unit="°C"
        min={10}
        max={40}
        precision={1}
        thresholds={{ low: 15, warnBelow: 18, warnAbove: 30, high: 34 }}
        value={numberOf(readings.chamber)}
        recent={history.chamber}
        setpoint={heater.confirmed}
        commanded={heater.commanded}
      >
        <div className="flex flex-wrap gap-2 border-t pt-3">
          {TARGETS.map((target) => (
            <Button
              key={target}
              variant={heater.commanded === target ? "secondary" : "outline"}
              size="sm"
              disabled={heater.pending}
              onClick={() => command("heater", target)}
            >
              {target} °C
            </Button>
          ))}
        </div>
      </RangeBar>
      <RangeBar
        orientation="vertical"
        label="Soil moisture"
        unit="%"
        min={0}
        max={100}
        precision={0}
        thresholds={{ low: 15, warnBelow: 25, warnAbove: 80 }}
        value={numberOf(readings.soil)}
        recent={history.soil}
      />
    </div>
  );
}

function numberOf(sample: WireSample | undefined): number | null {
  return typeof sample?.v === "number" ? sample.v : null;
}
