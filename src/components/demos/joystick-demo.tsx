import type { ReactElement } from "react";

import { Joystick } from "@/registry/benchcn/ui/joystick/joystick";

export function JoystickDemo(): ReactElement {
  return <Joystick className="mx-auto w-full max-w-sm" onChange={() => {}} />;
}
