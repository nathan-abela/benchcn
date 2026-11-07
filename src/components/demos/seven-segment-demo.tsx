import { type ReactElement, useEffect, useState } from "react";

import { useMockDevice } from "@/registry/benchcn/hooks/use-mock-device";
import { SevenSegment } from "@/registry/benchcn/ui/seven-segment/seven-segment";

function useClock(): string {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return now.getSeconds() % 2 === 0 ? `${hh}:${mm}` : `${hh} ${mm}`;
}

export function SevenSegmentDemo(): ReactElement {
  const { readings } = useMockDevice({ seed: 11 });
  const clock = useClock();
  const temp = readings.temp?.v;
  const battery = readings.battery?.v;

  return (
    <div className="flex flex-wrap items-end gap-6">
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
      <SevenSegment value={clock} color="amber" size={48} label="Clock" />
      <SevenSegment value="-12.5" color="blue" size={28} />
      <SevenSegment value="Err" size={28} />
    </div>
  );
}
