import type { ReactElement } from "react";

import { useMockDevice } from "@/registry/benchcn/hooks/use-mock-device";
import { INITIAL_ACTUATOR_STATE } from "@/registry/benchcn/lib/actuator";
import { EmergencyStop } from "@/registry/benchcn/ui/emergency-stop/emergency-stop";

export function EmergencyStopDemo(): ReactElement {
  const { actuators, command } = useMockDevice({ seed: 51 });
  const estop = actuators.estop ?? INITIAL_ACTUATOR_STATE;

  return (
    <EmergencyStop
      className="mx-auto w-full max-w-sm"
      description="Cell 2 conveyor"
      {...estop}
      onCommand={(engaged) => command("estop", engaged)}
    />
  );
}
