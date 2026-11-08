import type { ReactElement } from "react";

import { useMockDevice } from "@/registry/benchcn/hooks/use-mock-device";
import { MeterReadout } from "@/registry/benchcn/ui/meter-readout/meter-readout";

export function MeterReadoutDemo(): ReactElement {
  const { readings } = useMockDevice({ seed: 12, sampleInterval: 500 });
  const cell = readings.battery;

  return (
    <MeterReadout
      className="mx-auto w-full max-w-sm"
      label="Cell voltage"
      mode="DC V"
      value={typeof cell?.v === "number" ? cell.v : null}
      unit="V"
      sampleKey={cell}
      color="green"
    />
  );
}
