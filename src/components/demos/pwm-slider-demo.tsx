import type { ReactElement } from "react";

import { useMockDevice } from "@/registry/benchcn/hooks/use-mock-device";
import { INITIAL_ACTUATOR_STATE } from "@/registry/benchcn/lib/actuator";
import { setCommand } from "@/registry/benchcn/lib/wire";
import { PwmSlider } from "@/registry/benchcn/ui/pwm-slider/pwm-slider";

export function PwmSliderDemo(): ReactElement {
  const { setpoints, command, send } = useMockDevice({ seed: 5 });
  const dimmer = setpoints.dimmer ?? INITIAL_ACTUATOR_STATE;

  return (
    <PwmSlider
      className="mx-auto w-full max-w-sm"
      label="LED brightness"
      description="PWM on GPIO 18 · 1 kHz"
      {...dimmer}
      onChange={(duty) => send(setCommand("dimmer", duty))}
      onCommand={(duty) => command("dimmer", duty)}
    />
  );
}
