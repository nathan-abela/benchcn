import type { ReactElement } from "react";

import { useMockDevice } from "@/registry/benchcn/hooks/use-mock-device";
import { SevenSegment } from "@/registry/benchcn/ui/seven-segment/seven-segment";

import { useClock } from "./use-clock";

export function SevenSegmentDemo(): ReactElement {
  const { readings } = useMockDevice({ seed: 11 });
  const clock = useClock();
  const temp = readings.temp?.v;
  const battery = readings.battery?.v;

  return (
    <div className="flex flex-col items-start gap-5">
      <SevenSegment value={clock.time} colon={clock.colon} color="amber" size={48} label="Clock" />
      <SevenSegment
        value={typeof temp === "number" ? temp : "--.-"}
        decimals={1}
        digits={3}
        color="red"
        label={`Temperature ${temp} degrees`}
      />
      <SevenSegment
        value={typeof battery === "number" ? battery : "-.--"}
        decimals={2}
        digits={3}
        color="green"
        size={32}
      />
      <div className="flex flex-wrap items-end gap-6">
        <SevenSegment value="-12.5" color="blue" size={28} />
        <SevenSegment value="Err" size={28} />
      </div>
    </div>
  );
}
