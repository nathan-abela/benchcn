import { type ReactElement, useState } from "react";

import { SignalStrength } from "@/registry/benchcn/ui/signal-strength/signal-strength";

export function SignalStrengthDemo(): ReactElement {
  const [rssi, setRssi] = useState(-67);

  return (
    <div className="flex flex-col items-start gap-6">
      <div className="flex w-full max-w-sm flex-col gap-3">
        <SignalStrength className="text-2xl" label="Wi-Fi signal" value={rssi} />
        <input
          type="range"
          aria-label="RSSI"
          min={-105}
          max={-40}
          value={rssi}
          onChange={(event) => setRssi(Number(event.target.value))}
          className="accent-foreground w-full"
        />
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        <SignalStrength unit="%" value={92} />
        <SignalStrength unit="%" value={45} />
        <SignalStrength value={-84} bars={3} thresholds={[-95, -85, -75]} />
        <SignalStrength value={null} />
      </div>
    </div>
  );
}
