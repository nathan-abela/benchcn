import { type ReactElement, useState } from "react";

import { Button } from "@/components/ui/button";
import { boards } from "@/registry/benchcn/boards";
import type { Assignment } from "@/registry/benchcn/lib/pinout";
import { PinoutHeader } from "@/registry/benchcn/ui/pinout-header/pinout-header";

const WIRING: Record<string, Assignment[]> = {
  "raspberry-pi-40pin": [
    { pin: 1, part: "BME280", signal: "VIN" },
    { pin: 3, part: "BME280", signal: "SDA", use: "i2c" },
    { pin: 5, part: "BME280", signal: "SCL", use: "i2c" },
    { pin: 9, part: "BME280", signal: "GND" },
    { pin: 11, part: "Relay", signal: "IN", use: "gpio" },
  ],
  "raspberry-pi-pico": [
    { pin: 1, part: "OLED", signal: "SDA", use: "i2c" },
    { pin: 2, part: "OLED", signal: "SCL", use: "i2c" },
    { pin: 31, part: "Soil", signal: "AOUT", use: "adc" },
    { pin: 20, part: "Relay", signal: "IN", use: "gpio" },
  ],
  "esp32-devkitc-v4": [],
  "arduino-uno-r3": [],
};

const MISTAKE: Record<string, Assignment[]> = {
  "raspberry-pi-40pin": [{ pin: 11, part: "Buzzer", signal: "SIG", use: "gpio" }],
  "raspberry-pi-pico": [{ pin: 6, part: "BME280", signal: "SDA", use: "i2c" }],
  "esp32-devkitc-v4": [],
  "arduino-uno-r3": [],
};

export function PinoutHeaderDemo(): ReactElement {
  const [boardId, setBoardId] = useState(boards[0].id);
  const [mistake, setMistake] = useState(false);
  const board = boards.find((b) => b.id === boardId) ?? boards[0];
  const assignments = [...(WIRING[boardId] ?? []), ...(mistake ? (MISTAKE[boardId] ?? []) : [])];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {boards.map((b) => (
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
          disabled={(MISTAKE[boardId] ?? []).length === 0}
        >
          {mistake ? "Fix the wiring" : "Add a wiring mistake"}
        </Button>
      </div>
      <PinoutHeader board={board} assignments={assignments} />
    </div>
  );
}
