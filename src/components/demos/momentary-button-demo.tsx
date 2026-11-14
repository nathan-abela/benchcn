import type { ReactElement } from "react";

import { useMockDevice } from "@/registry/benchcn/hooks/use-mock-device";
import { INITIAL_ACTUATOR_STATE } from "@/registry/benchcn/lib/actuator";
import { MomentaryButton } from "@/registry/benchcn/ui/momentary-button/momentary-button";

export function MomentaryButtonDemo(): ReactElement {
  const { actuators, command } = useMockDevice({ seed: 4 });
  const conveyor = actuators.conveyor ?? INITIAL_ACTUATOR_STATE;

  return (
    <MomentaryButton
      className="mx-auto w-full max-w-sm"
      label="Conveyor"
      description="Motor relay on GPIO 22"
      action="Hold to jog"
      {...conveyor}
      onCommand={(on) => command("conveyor", on)}
    />
  );
}
