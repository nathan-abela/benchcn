import type { ReactElement } from "react";

import { useMockDevice } from "@/registry/benchcn/hooks/use-mock-device";
import { type ActuatorState, INITIAL_ACTUATOR_STATE } from "@/registry/benchcn/lib/actuator";
import { roundTo } from "@/registry/benchcn/lib/stepper";
import { DPad } from "@/registry/benchcn/ui/d-pad/d-pad";

const TRAVEL = 50;

export function DPadDemo(): ReactElement {
  const { setpoints, command } = useMockDevice({ seed: 9 });
  const x = setpoints["jog-x"] ?? INITIAL_ACTUATOR_STATE;
  const y = setpoints["jog-y"] ?? INITIAL_ACTUATOR_STATE;

  // Steps add to the last commanded target, not the confirmed one, so a fast hold does not
  // resend the same position while acknowledgements are still on their way.
  const jog = (id: string, axis: ActuatorState<number>, delta: number) => {
    const from = axis.commanded ?? axis.confirmed ?? 0;
    command(id, roundTo(Math.min(TRAVEL, Math.max(-TRAVEL, from + delta)), 2));
  };

  return (
    <DPad
      className="mx-auto w-full max-w-md"
      label="Stage"
      description={`Two-axis stage · ±${TRAVEL} mm`}
      position={{ x: x.confirmed, y: y.confirmed }}
      pending={x.pending || y.pending}
      error={x.error ?? y.error}
      onJog={(move) => {
        if (move.x !== 0) jog("jog-x", x, move.x);
        if (move.y !== 0) jog("jog-y", y, move.y);
      }}
      onHome={() => {
        command("jog-x", 0);
        command("jog-y", 0);
      }}
    />
  );
}
