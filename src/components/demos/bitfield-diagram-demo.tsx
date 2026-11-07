import { type ReactElement, useState } from "react";

import type { Bitfield } from "@/registry/benchcn/lib/bitfield";
import { BitfieldDiagram } from "@/registry/benchcn/ui/bitfield-diagram/bitfield-diagram";

// BME280 register 0xF4 "ctrl_meas", Bosch BST-BME280-DS002, section 5.4.5.
const CTRL_MEAS: Bitfield[] = [
  {
    name: "mode",
    bits: 2,
    description: "Sensor mode",
    values: { 0: "sleep", 1: "forced", 2: "forced", 3: "normal" },
  },
  {
    name: "osrs_p",
    bits: 3,
    description: "Pressure oversampling",
    values: { 0: "skip", 1: "×1", 2: "×2", 3: "×4", 4: "×8", 5: "×16" },
  },
  {
    name: "osrs_t",
    bits: 3,
    description: "Temperature oversampling",
    values: { 0: "skip", 1: "×1", 2: "×2", 3: "×4", 4: "×8", 5: "×16" },
  },
];

const TIMER: Bitfield[] = [
  { name: "EN", bits: [0, 0], description: "Counter enable" },
  { name: "DIR", bits: [1, 1], description: "0 = up, 1 = down" },
  { name: "PSC", bits: [7, 4], description: "Prescaler, 2^PSC" },
  { name: "ARR", bits: [23, 8], access: "RW", description: "Auto-reload value" },
  { name: "UIF", bits: [31, 31], access: "W1C", description: "Update interrupt flag" },
];

export function BitfieldDiagramDemo(): ReactElement {
  const [ctrl, setCtrl] = useState(0b01001011);
  const [timer, setTimer] = useState(0x80012c31);

  return (
    <div className="flex flex-col gap-4">
      <BitfieldDiagram
        title="BME280 ctrl_meas"
        name="0xF4"
        fields={CTRL_MEAS}
        bits={8}
        value={ctrl}
        onValueChange={setCtrl}
      />
      <BitfieldDiagram
        title="Example timer control"
        name="TIMx_CR"
        fields={TIMER}
        bits={32}
        value={timer}
        onValueChange={setTimer}
      />
    </div>
  );
}
