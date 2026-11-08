import { type ReactElement, useState } from "react";

import { Button } from "@/components/ui/button";
import { useAlarms } from "@/registry/benchcn/hooks/use-alarms";
import { useMockDevice } from "@/registry/benchcn/hooks/use-mock-device";
import type { AlarmRule } from "@/registry/benchcn/lib/alarms";
import { AlarmList } from "@/registry/benchcn/ui/alarm-list/alarm-list";
import { RangeBar } from "@/registry/benchcn/ui/range-bar/range-bar";

const RULES: AlarmRule[] = [
  {
    id: "chamber-high",
    channel: "chamber",
    message: "Chamber temperature high",
    priority: "medium",
    above: 26,
    deadband: 0.5,
  },
  {
    id: "chamber-very-high",
    channel: "chamber",
    message: "Chamber temperature very high",
    priority: "critical",
    above: 30,
    deadband: 0.5,
  },
  {
    id: "chamber-lost",
    channel: "chamber",
    message: "Chamber sensor not reporting",
    priority: "high",
    staleAfter: 2000,
  },
];

export function AlarmListDemo(): ReactElement {
  const source = useMockDevice({ seed: 9, sampleInterval: 500, faultRate: 0 });
  const { alarms, acknowledge, acknowledgeAll, shelve, unshelve } = useAlarms(source, RULES);
  const [linked, setLinked] = useState(true);
  const heater = source.setpoints.heater;
  const chamber = source.readings.chamber;

  const toggleLink = () => {
    if (linked) source.device.stop();
    else source.device.start();
    setLinked(!linked);
  };

  return (
    <div className="flex flex-col gap-4">
      <AlarmList
        alarms={alarms}
        onAcknowledge={acknowledge}
        onAcknowledgeAll={acknowledgeAll}
        onShelve={shelve}
        onUnshelve={unshelve}
      />
      {/* What drives the alarms, kept outside the list so the preview shows only what it renders. */}
      <RangeBar
        label="Chamber temperature"
        unit="°C"
        min={15}
        max={35}
        precision={1}
        thresholds={{ warnAbove: 26, high: 30 }}
        value={typeof chamber?.v === "number" ? chamber.v : null}
        recent={source.history.chamber}
        setpoint={heater?.confirmed}
        commanded={heater?.commanded}
      >
        <div className="flex flex-wrap gap-2 border-t pt-3">
          <Button
            variant="outline"
            size="sm"
            disabled={heater?.pending}
            onClick={() => source.command("heater", heater?.commanded === 33 ? 20 : 33)}
          >
            {heater?.commanded === 33 ? "Cool to 20 °C" : "Heat to 33 °C"}
          </Button>
          <Button variant="outline" size="sm" aria-pressed={!linked} onClick={toggleLink}>
            {linked ? "Drop the link" : "Reconnect"}
          </Button>
        </div>
      </RangeBar>
    </div>
  );
}
