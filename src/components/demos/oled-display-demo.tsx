import { type ReactElement, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { useMockDevice } from "@/registry/benchcn/hooks/use-mock-device";
import {
  type Bitmap,
  createBitmap,
  drawLine,
  drawRect,
  drawText,
  fillRect,
  textWidth,
  toSsd1306,
} from "@/registry/benchcn/lib/bitmap";
import { OledDisplay } from "@/registry/benchcn/ui/oled-display/oled-display";

import { useClock } from "./use-clock";

const WIDTH = 128;

function reading(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function drawSparkline(bitmap: Bitmap, values: number[], top: number, height: number): void {
  if (values.length < 2) return;
  const min = Math.min(...values);
  const span = Math.max(...values) - min || 1;
  const toY = (v: number) => top + height - 1 - Math.round(((v - min) / span) * (height - 1));
  const stepX = (WIDTH - 1) / (values.length - 1);
  for (let i = 1; i < values.length; i += 1) {
    drawLine(bitmap, (i - 1) * stepX, toY(values[i - 1]), i * stepX, toY(values[i]));
  }
}

function drawStation(time: string, temp?: number, humidity?: number, history?: number[]): Bitmap {
  const bitmap = createBitmap(WIDTH, 64);
  drawText(bitmap, "benchcn", 1, 4);
  drawText(bitmap, time, WIDTH - 1 - textWidth(time), 4);

  const reading = typeof temp === "number" ? temp.toFixed(1) : "--.-";
  const next = drawText(bitmap, reading, 1, 20, { scale: 3 });
  drawText(bitmap, "°C", next, 20);
  const rh = `${typeof humidity === "number" ? humidity.toFixed(0) : "--"}% RH`;
  drawText(bitmap, rh, WIDTH - 1 - textWidth(rh), 36);

  drawSparkline(bitmap, history ?? [], 49, 15);
  return bitmap;
}

function drawBattery(volts?: number): Bitmap {
  const bitmap = createBitmap(WIDTH, 32);
  const level = typeof volts === "number" ? Math.min(1, Math.max(0, (volts - 3) / 1.2)) : 0;
  drawText(bitmap, "BATTERY", 2, 3);
  const text = typeof volts === "number" ? `${volts.toFixed(2)} V` : "-.-- V";
  drawText(bitmap, text, WIDTH - 2 - textWidth(text), 3);
  drawRect(bitmap, 2, 15, 118, 14);
  fillRect(bitmap, 120, 19, 3, 6);
  fillRect(bitmap, 4, 17, Math.round(114 * level), 10);
  return bitmap;
}

export function OledDisplayDemo(): ReactElement {
  const { readings, history } = useMockDevice({ seed: 6, sampleInterval: 1000 });
  const clock = useClock();
  const [on, setOn] = useState(true);
  const [invert, setInvert] = useState(false);

  const temp = reading(readings.temp?.v);
  const humidity = reading(readings.humidity?.v);
  const battery = reading(readings.battery?.v);

  const station = useMemo(
    () => drawStation(clock.time, temp, humidity, history.temp),
    [clock.time, temp, humidity, history.temp],
  );
  // The second module takes the bytes a driver would send, not a bitmap.
  const batteryRam = useMemo(() => toSsd1306(drawBattery(battery)), [battery]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-6">
        <OledDisplay
          bitmap={station}
          color="yellow-blue"
          on={on}
          invert={invert}
          label={`Temperature ${temp} degrees, humidity ${humidity} percent`}
        />
        <OledDisplay
          buffer={batteryRam}
          height={32}
          on={on}
          invert={invert}
          label={`Battery ${battery} volts`}
        />
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setOn((value) => !value)}>
          Display {on ? "off" : "on"}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setInvert((value) => !value)}>
          {invert ? "Normal" : "Invert"}
        </Button>
      </div>
    </div>
  );
}
