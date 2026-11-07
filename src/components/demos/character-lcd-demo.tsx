import { type ReactElement, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { useMockDevice } from "@/registry/benchcn/hooks/use-mock-device";
import { CharacterLcd } from "@/registry/benchcn/ui/character-lcd/character-lcd";

const THERMOMETER = [0b00100, 0b01010, 0b01010, 0b01110, 0b01110, 0b11111, 0b11111, 0b01110];
const DROP = [0b00100, 0b00100, 0b01010, 0b01010, 0b10001, 0b10001, 0b10001, 0b01110];

export function CharacterLcdDemo(): ReactElement {
  const { readings } = useMockDevice({ seed: 4 });
  const [backlight, setBacklight] = useState(true);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setTick((t) => t + 1), 500);
    return () => window.clearInterval(timer);
  }, []);

  const temp = readings.temp?.v;
  const humidity = readings.humidity?.v;
  const line1 = `\u0001 ${typeof temp === "number" ? temp.toFixed(1) : "--.-"}°C`;
  const line2 = `\u0002 ${typeof humidity === "number" ? humidity.toFixed(0) : "--"}% RH`;
  const banner = "benchcn.dev    ";
  const offset = tick % banner.length;
  const scrolled = (banner + banner).slice(offset, offset + 16);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-6">
        <CharacterLcd
          lines={[line1.padEnd(16), line2.padEnd(16)]}
          customGlyphs={{ "\u0001": THERMOMETER, "\u0002": DROP }}
          backlight={backlight}
          label={`Temperature ${temp} degrees, humidity ${humidity} percent`}
        />
        <CharacterLcd lines={["Hello, world!", scrolled]} color="blue" />
      </div>
      <div className="flex flex-wrap items-end gap-6">
        <CharacterLcd
          lines={["PUMP   ON  12:04", "SOIL 38% → wet"]}
          color="amber"
          cursor={{ col: 15, row: 1, blink: true }}
          scale={2.5}
        />
        <CharacterLcd
          lines={["20x4 module", "", "¥ → ← °", "line four"]}
          cols={20}
          rows={4}
          color="white"
          scale={2}
        />
      </div>
      <div>
        <Button variant="outline" size="sm" onClick={() => setBacklight((b) => !b)}>
          Backlight {backlight ? "off" : "on"}
        </Button>
      </div>
    </div>
  );
}
