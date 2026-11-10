import { type ReactElement, type ReactNode, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { createMockDevice } from "@/registry/benchcn/lib/mock-device";
import { formatSi, stepValue } from "@/registry/benchcn/lib/units";
import {
  Oscilloscope,
  type OscilloscopeProps,
  type ScopeChannel,
} from "@/registry/benchcn/ui/oscilloscope/oscilloscope";

const BUFFER = 8192;
const MIN_TIMEBASE = 0.00001;
const MAX_TIMEBASE = 0.01;

type Cursors = NonNullable<OscilloscopeProps["cursors"]>;

const NEXT_CURSORS: Record<Cursors, Cursors> = { off: "time", time: "voltage", voltage: "off" };
const CURSOR_LABELS: Record<Cursors, string> = {
  off: "Cursors off",
  time: "Time cursors",
  voltage: "Voltage cursors",
};

export function OscilloscopeDemo(): ReactElement {
  const device = useMemo(() => createMockDevice({ seed: 7 }), []);
  const [timebase, setTimebase] = useState(0.0002);
  const [level, setLevel] = useState(0.2);
  const [edge, setEdge] = useState<"rising" | "falling">("rising");
  const [running, setRunning] = useState(true);
  const [voltsPerDiv, setVoltsPerDiv] = useState(0.5);
  const [cursors, setCursors] = useState<Cursors>("off");

  const channels = useMemo<ScopeChannel[]>(() => {
    const sampleRate = Math.min(2_000_000, Math.round(2000 / (timebase * 10)));
    const spanMs = (BUFFER / sampleRate) * 1000;
    const pull = (ch: string) => () => device.waveform(ch, Date.now() - spanMs, BUFFER, sampleRate);
    return [
      { id: "ch1", label: "CH1", data: pull("ch1"), sampleRate, voltsPerDiv },
      { id: "ch2", label: "CH2", data: pull("ch2"), sampleRate, voltsPerDiv: 1, offset: -2.5 },
    ];
  }, [device, timebase, voltsPerDiv]);

  const changeTimebase = (direction: 1 | -1) =>
    setTimebase((t) => Math.min(MAX_TIMEBASE, Math.max(MIN_TIMEBASE, stepValue(t, direction))));

  return (
    <Oscilloscope
      channels={channels}
      timebase={timebase}
      trigger={{ source: "ch1", level, edge }}
      running={running}
      cursors={cursors}
      onTriggerLevelChange={setLevel}
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t pt-3">
        <Knob label="Time/div" value={formatSi(timebase, "s")}>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Slower"
            onClick={() => changeTimebase(1)}
          >
            −
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Faster"
            onClick={() => changeTimebase(-1)}
          >
            +
          </Button>
        </Knob>
        <Knob label="CH1 V/div" value={formatSi(voltsPerDiv, "V")}>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Coarser"
            onClick={() => setVoltsPerDiv((v) => Math.min(5, stepValue(v, 1)))}
          >
            −
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Finer"
            onClick={() => setVoltsPerDiv((v) => Math.max(0.01, stepValue(v, -1)))}
          >
            +
          </Button>
        </Knob>
        <Knob label="Trigger" value={`${edge === "rising" ? "↑" : "↓"} ${formatSi(level, "V")}`}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEdge((e) => (e === "rising" ? "falling" : "rising"))}
          >
            {edge === "rising" ? "Rising" : "Falling"}
          </Button>
        </Knob>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCursors((current) => NEXT_CURSORS[current])}
        >
          {CURSOR_LABELS[cursors]}
        </Button>
        <Button
          variant={running ? "outline" : "default"}
          size="sm"
          className="ml-auto"
          onClick={() => setRunning((r) => !r)}
        >
          {running ? "Stop" : "Run"}
        </Button>
      </div>
    </Oscilloscope>
  );
}

function Knob({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children: ReactNode;
}): ReactElement {
  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground text-xs leading-none">{label}</span>
        <span className="text-sm leading-none font-medium tabular-nums">{value}</span>
      </div>
      <div className="flex items-center gap-1">{children}</div>
    </div>
  );
}
