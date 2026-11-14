import { type ReactElement, useState } from "react";

import { useMockDevice } from "@/registry/benchcn/hooks/use-mock-device";
import { INITIAL_ACTUATOR_STATE } from "@/registry/benchcn/lib/actuator";
import { RotaryEncoder } from "@/registry/benchcn/ui/rotary-encoder/rotary-encoder";

const STEPS = [0.01, 0.1, 1];

export function RotaryEncoderDemo(): ReactElement {
  const { setpoints, command } = useMockDevice({ seed: 8 });
  const [step, setStep] = useState(0.1);
  const volts = setpoints["psu-v"] ?? INITIAL_ACTUATOR_STATE;

  return (
    <RotaryEncoder
      className="mx-auto w-full max-w-sm"
      label="Supply voltage"
      description={`Step ${step} V`}
      unit="V"
      min={0}
      max={30}
      step={step}
      precision={2}
      {...volts}
      onCommand={(next) => command("psu-v", next)}
      onPress={() => setStep(STEPS[(STEPS.indexOf(step) + 1) % STEPS.length])}
      pressLabel="Change step"
    />
  );
}
