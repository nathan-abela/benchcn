import type { ReactElement } from "react";

import { useMockDevice } from "@/registry/benchcn/hooks/use-mock-device";
import { INITIAL_ACTUATOR_STATE } from "@/registry/benchcn/lib/actuator";
import { MomentaryButton } from "@/registry/benchcn/ui/momentary-button/momentary-button";

export function MomentaryButtonDemo(): ReactElement {
  const { actuators, command } = useMockDevice({ seed: 4 });
  const horn = actuators.horn ?? INITIAL_ACTUATOR_STATE;

  return (
    <MomentaryButton
      className="mx-auto w-full max-w-sm"
      label="Horn"
      description="Relay on GPIO 22 · on only while held"
      action="Hold to sound"
      {...horn}
      onCommand={(on) => command("horn", on)}
    />
  );
}
