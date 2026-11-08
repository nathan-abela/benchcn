import type { ReactElement } from "react";

import { useMockDevice } from "@/registry/benchcn/hooks/use-mock-device";
import { useStripSeries } from "@/registry/benchcn/hooks/use-strip-series";
import { INITIAL_ACTUATOR_STATE } from "@/registry/benchcn/lib/actuator";
import { SetpointInput } from "@/registry/benchcn/ui/setpoint-input/setpoint-input";
import { StripChart } from "@/registry/benchcn/ui/strip-chart/strip-chart";

export function SetpointInputDemo(): ReactElement {
  const source = useMockDevice({ seed: 6, sampleInterval: 500, failSafe: { heater: 15 } });
  const heater = source.setpoints.heater ?? INITIAL_ACTUATOR_STATE;
  const chamber = source.readings.chamber;
  const series = useStripSeries(source, ["chamber"]);

  return (
    <div className="flex flex-col gap-4">
      <SetpointInput
        label="Heater setpoint"
        description="Chamber heater · 2 s timeout · fail-safe 15 °C"
        unit="°C"
        min={15}
        max={35}
        step={0.5}
        confirm={5}
        value={typeof chamber?.v === "number" ? chamber.v : null}
        {...heater}
        onCommand={(next) => source.command("heater", next)}
      />
      <StripChart title="Chamber" series={series} seconds={60} min={14} max={36} height={160} />
    </div>
  );
}
