import { type ReactElement, useState } from "react";

import { Button } from "@/components/ui/button";
import { raspberryPi40Pin, raspberryPiPico } from "@/registry/benchcn/boards";
import type { Assignment } from "@/registry/benchcn/lib/pinout";
import { WiringTable } from "@/registry/benchcn/ui/wiring-table/wiring-table";

const BOARDS = [raspberryPi40Pin, raspberryPiPico];

const WIRING: Record<string, Assignment[]> = {
  "raspberry-pi-40pin": [
    { pin: 1, part: "BME280", signal: "VIN", wire: "red" },
    { pin: 3, part: "BME280", signal: "SDA", use: "i2c", wire: "blue" },
    { pin: 5, part: "BME280", signal: "SCL", use: "i2c", wire: "yellow" },
    { pin: 9, part: "BME280", signal: "GND", wire: "black" },
    { pin: 11, part: "Relay", signal: "IN", use: "gpio", wire: "green", note: "Active low" },
  ],
  "raspberry-pi-pico": [
    { pin: 1, part: "OLED", signal: "SDA", use: "i2c", wire: "blue" },
    { pin: 2, part: "OLED", signal: "SCL", use: "i2c", wire: "yellow" },
    { pin: 31, part: "Soil", signal: "AOUT", use: "adc", wire: "white" },
    { pin: 20, part: "Relay", signal: "IN", use: "gpio", wire: "green", note: "Active low" },
  ],
};

const MISTAKE: Record<string, Assignment[]> = {
  "raspberry-pi-40pin": [
    { pin: 11, part: "Buzzer", signal: "SIG", use: "gpio", voltage: 5, wire: "orange" },
  ],
  "raspberry-pi-pico": [{ pin: 6, part: "BME280", signal: "SDA", use: "i2c", wire: "blue" }],
};

export function WiringTableDemo(): ReactElement {
  const [boardId, setBoardId] = useState(BOARDS[0].id);
  const [mistake, setMistake] = useState(false);
  const board = BOARDS.find((b) => b.id === boardId) ?? BOARDS[0];
  const assignments = [...WIRING[boardId], ...(mistake ? MISTAKE[boardId] : [])];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {BOARDS.map((b) => (
          <Button
            key={b.id}
            variant={b.id === boardId ? "default" : "outline"}
            size="sm"
            onClick={() => setBoardId(b.id)}
          >
            {b.name}
          </Button>
        ))}
        <Button
          variant={mistake ? "destructive" : "outline"}
          size="sm"
          className="ml-auto"
          onClick={() => setMistake((m) => !m)}
        >
          {mistake ? "Fix the wiring" : "Add a wiring mistake"}
        </Button>
      </div>
      <WiringTable board={board} assignments={assignments} />
    </div>
  );
}
