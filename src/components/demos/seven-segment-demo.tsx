import { type ReactElement, useSyncExternalStore } from "react";

import { useMockDevice } from "@/registry/benchcn/hooks/use-mock-device";
import { SevenSegment } from "@/registry/benchcn/ui/seven-segment/seven-segment";

function subscribeClock(onChange: () => void): () => void {
  const timer = window.setInterval(onChange, 1000);
  return () => window.clearInterval(timer);
}

function readClock(): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return now.getSeconds() % 2 === 0 ? `${hh}:${mm}` : `${hh} ${mm}`;
}

/** Wall-clock time as HH:MM with a blinking colon; blank in the prerendered HTML so hydration matches. */
function useClock(): string {
  return useSyncExternalStore(subscribeClock, readClock, () => "--:--");
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
