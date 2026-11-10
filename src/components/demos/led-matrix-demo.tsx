import { type ReactElement, useMemo } from "react";

import { useMockDevice } from "@/registry/benchcn/hooks/use-mock-device";
import { type Bitmap, createBitmap, setPixel } from "@/registry/benchcn/lib/bitmap";
import { LedMatrix } from "@/registry/benchcn/ui/led-matrix/led-matrix";

import { useClock } from "./use-clock";

const HEART = [
  ".##..##.",
  "########",
  "########",
  "########",
  ".######.",
  "..####..",
  "...##...",
  "........",
];

function fromRows(rows: string[]): Bitmap {
  const bitmap = createBitmap(rows[0].length, rows.length);
  rows.forEach((row, y) => {
    Array.from(row).forEach((cell, x) => setPixel(bitmap, x, y, cell === "#"));
  });
  return bitmap;
}

export function LedMatrixDemo(): ReactElement {
  const { readings } = useMockDevice({ seed: 8, sampleInterval: 2000 });
  const clock = useClock();
  const heart = useMemo(() => fromRows(HEART), []);

  const temp = readings.temp?.v;
  const humidity = readings.humidity?.v;
  const message = `TEMP ${typeof temp === "number" ? temp.toFixed(1) : "--.-"}°C   HUMIDITY ${
    typeof humidity === "number" ? humidity.toFixed(0) : "--"
  }%`;

  return (
    <div className="flex flex-col items-start gap-6">
      <LedMatrix text={message} color="red" />
      <div className="flex flex-wrap items-end gap-6">
        <LedMatrix text={clock.time} color="green" label={`Clock ${clock.time}`} />
        <LedMatrix bitmap={heart} cols={8} color="amber" shape="square" size={12} label="Heart" />
      </div>
    </div>
  );
}
