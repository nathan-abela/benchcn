import { type ReactElement, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useMockDevice } from "@/registry/benchcn/hooks/use-mock-device";
import type { LinkStatus } from "@/registry/benchcn/lib/connection";
import { ConnectionStatus } from "@/registry/benchcn/ui/connection-status/connection-status";

// What a reconnecting WebSocket source reports after a drop: two failed tries, then back.
const RECONNECT: [LinkStatus, number][] = [
  ["closed", 0],
  ["connecting", 500],
  ["error", 1500],
  ["closed", 1600],
  ["connecting", 2600],
  ["error", 3600],
  ["closed", 3700],
  ["connecting", 5700],
  ["open", 6400],
];

export function ConnectionStatusDemo(): ReactElement {
  const mock = useMockDevice({ seed: 4 });
  const { device } = mock;
  const [paused, setPaused] = useState(false);
  const [dropped, setDropped] = useState<LinkStatus | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const togglePause = () => {
    if (paused) device.start();
    else device.stop();
    setPaused(!paused);
  };

  const drop = () => {
    device.stop();
    timers.current = RECONNECT.map(([status, at]) =>
      window.setTimeout(() => {
        if (status !== "open") return setDropped(status);
        device.start();
        setDropped(null);
        setPaused(false);
      }, at),
    );
  };

  return (
    <div className="flex flex-col items-start gap-6">
      <div className="flex flex-col items-start gap-3">
        <ConnectionStatus
          label="Mock device"
          source={mock}
          status={dropped ?? undefined}
          staleAfter={3000}
        />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={dropped !== null} onClick={togglePause}>
            {paused ? "Resume" : "Pause messages"}
          </Button>
          <Button variant="outline" size="sm" disabled={dropped !== null} onClick={drop}>
            Drop link
          </Button>
        </div>
      </div>
      <div className="flex flex-col items-start gap-2">
        <ConnectionStatus label="Serial" status="idle" />
        <ConnectionStatus label="Robot" status="connecting" attempts={4} />
        <ConnectionStatus label="Broker" status="error" />
        <ConnectionStatus label="USB" status="unsupported" />
      </div>
    </div>
  );
}
