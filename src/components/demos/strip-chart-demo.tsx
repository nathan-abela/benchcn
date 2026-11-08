import { type ReactElement, useState } from "react";

import { Button } from "@/components/ui/button";
import { useMockDevice } from "@/registry/benchcn/hooks/use-mock-device";
import { useStripSeries } from "@/registry/benchcn/hooks/use-strip-series";
import { INITIAL_ACTUATOR_STATE } from "@/registry/benchcn/lib/actuator";
import { ActuatorControl } from "@/registry/benchcn/ui/actuator-control/actuator-control";
import { StripChart } from "@/registry/benchcn/ui/strip-chart/strip-chart";

export function StripChartDemo(): ReactElement {
  const source = useMockDevice({ seed: 5, sampleInterval: 500, failSafe: { pump: false } });
  const series = useStripSeries(source, ["soil", "humidity"]);
  const [linked, setLinked] = useState(true);
  const pump = source.actuators.pump ?? INITIAL_ACTUATOR_STATE;

  const toggleLink = () => {
    if (linked) source.device.stop();
    else source.device.start();
    setLinked(!linked);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <StripChart title="Soil and humidity" series={series} seconds={60} staleAfter={2000}>
        <div className="flex justify-end border-t pt-3">
          <Button variant="outline" size="sm" aria-pressed={!linked} onClick={toggleLink}>
            {linked ? "Drop the link" : "Reconnect"}
          </Button>
        </div>
      </StripChart>
      <ActuatorControl
        className="self-start"
        label="Water pump"
        description="Relay on GPIO 17"
        {...pump}
        onCommand={(next) => source.command("pump", next)}
      />
    </div>
  );
}
