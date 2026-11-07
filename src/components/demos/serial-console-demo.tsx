import { type ReactElement, useState } from "react";

import { useMockDevice } from "@/registry/benchcn/hooks/use-mock-device";
import { isCommand, parseLine } from "@/registry/benchcn/lib/wire";
import {
  type ConsoleLine,
  SerialConsole,
} from "@/registry/benchcn/ui/serial-console/serial-console";

export function SerialConsoleDemo(): ReactElement {
  const { logs, send } = useMockDevice({ seed: 9, sampleInterval: 4000 });
  const [sent, setSent] = useState<ConsoleLine[]>([]);

  const lines: ConsoleLine[] = [
    ...logs.map((log, i) => ({ id: `log-${i}`, text: log.log, level: log.lvl, t: log.t })),
    ...sent,
  ].sort((a, b) => (a.t ?? 0) - (b.t ?? 0));

  const onCommand = (line: string) => {
    const now = Date.now() / 1000;
    setSent((s) => [...s, { id: `out-${now}`, text: line, direction: "out", t: now }]);
    const message = parseLine(line);
    if (message && isCommand(message)) {
      send(message);
    } else {
      setSent((s) => [
        ...s,
        {
          id: `err-${now}`,
          text: 'not a command; try {"cmd":"ping","n":1}',
          level: "warn",
          t: now,
        },
      ]);
    }
  };

  return (
    <SerialConsole
      lines={lines}
      onCommand={onCommand}
      status="mock · 115200"
      placeholder='{"cmd":"set","n":1,"id":"pump","v":true}'
    />
  );
}
