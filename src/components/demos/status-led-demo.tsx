import type { ReactElement } from "react";

import { useMockDevice } from "@/registry/benchcn/hooks/use-mock-device";
import { StatusLed } from "@/registry/benchcn/ui/status-led/status-led";

export function StatusLedDemo(): ReactElement {
  const { readings, actuators } = useMockDevice({ seed: 5 });
  const linkUp = Object.keys(readings).length > 0;
  const battery = readings.battery?.v;
  const lowBattery = typeof battery === "number" && battery < 3.5;

  return (
    <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
      <div className="flex flex-col gap-3">
        <StatusLed label="Power" color="green" showLabel />
        <StatusLed label="Link" color="blue" pattern="heartbeat" rate={1} on={linkUp} showLabel />
        <StatusLed label="Pump" color="amber" on={actuators.pump?.confirmed ?? false} showLabel />
        <StatusLed label="Battery" color="red" pattern="blink" rate={2} on={lowBattery} showLabel />
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <StatusLed label="Red" color="red" size="sm" />
          <StatusLed label="Amber" color="amber" size="sm" />
          <StatusLed label="Green" color="green" size="sm" />
          <StatusLed label="Blue" color="blue" size="sm" />
          <StatusLed label="White" color="white" size="sm" />
          <StatusLed label="Theme" size="sm" />
        </div>
        <div className="flex items-center gap-3">
          <StatusLed label="Red off" color="red" on={false} />
          <StatusLed label="Amber off" color="amber" on={false} />
          <StatusLed label="Green off" color="green" on={false} />
          <StatusLed label="Pulse" color="green" pattern="pulse" rate={1} size="lg" />
        </div>
      </div>
    </div>
  );
}
