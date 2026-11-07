import type { ReactElement } from "react";

import { useMockDevice } from "@/registry/benchcn/hooks/use-mock-device";
import { INITIAL_ACTUATOR_STATE } from "@/registry/benchcn/lib/actuator";
import { ActuatorControl } from "@/registry/benchcn/ui/actuator-control/actuator-control";

export function ActuatorControlDemo(): ReactElement {
  const { actuators, logs, command } = useMockDevice({
    seed: 3,
    actuatorTimeout: 2000,
    failSafe: { pump: false },
  });
  const pump = actuators.pump ?? INITIAL_ACTUATOR_STATE;
  const led = actuators.led ?? INITIAL_ACTUATOR_STATE;

  return (
    <div className="flex flex-col gap-4">
      <ActuatorControl
        label="Water pump"
        description="Relay on GPIO 17 · fail-safe off · 2 s timeout"
        {...pump}
        onCommand={(next) => command("pump", next)}
      />
      <ActuatorControl
        label="Status LED"
        description="GPIO 27 · tap to toggle"
        holdMs={0}
        {...led}
        onCommand={(next) => command("led", next)}
      />
      <ol className="text-muted-foreground flex flex-col gap-1 px-1 font-mono text-xs">
        {logs.slice(-4).map((log) => (
          <li key={`${log.t ?? 0}:${log.log}`} className="truncate">
            <span className="text-muted-foreground/60">{log.lvl?.padEnd(5) ?? "info "}</span>{" "}
            {log.log}
          </li>
        ))}
      </ol>
    </div>
  );
}
