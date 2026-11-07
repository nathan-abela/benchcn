import { type ReactElement, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { encodeI2c, type I2cTransaction } from "@/registry/benchcn/lib/decoders/i2c";
import { createRandom } from "@/registry/benchcn/lib/mock-device";
import { LogicAnalyzer, type LogicLane } from "@/registry/benchcn/ui/logic-analyzer/logic-analyzer";

const SAMPLE_RATE = 1_000_000;

function bme280Burst(rand: () => number): I2cTransaction[] {
  const bytes = Array.from({ length: 8 }, () => Math.floor(rand() * 256));
  return [
    { address: 0x76, read: false, data: [0xf7] },
    { address: 0x76, read: true, data: bytes, repeatedStart: true },
  ];
}

function captureTrace(seed: number) {
  const rand = createRandom(seed);
  const transactions: I2cTransaction[] = [
    ...bme280Burst(rand),
    { address: 0x3c, read: false, data: [0x00, 0xae] },
    { address: 0x48, read: false, data: [0x01, 0xc3, 0x83] },
    ...bme280Burst(rand),
  ];
  return encodeI2c(transactions, { sampleRate: SAMPLE_RATE, clockHz: 100_000 });
}

export function LogicAnalyzerDemo(): ReactElement {
  const [seed, setSeed] = useState(1);
  const lanes = useMemo<LogicLane[]>(() => {
    const trace = captureTrace(seed);
    return [
      { id: "scl", label: "SCL", data: trace.scl, sampleRate: SAMPLE_RATE },
      { id: "sda", label: "SDA", data: trace.sda, sampleRate: SAMPLE_RATE },
    ];
  }, [seed]);

  return (
    <LogicAnalyzer lanes={lanes} decode={{ protocol: "i2c", sda: "sda", scl: "scl" }}>
      <div className="flex items-center justify-between border-t pt-3">
        <span className="text-muted-foreground font-mono text-[11px] uppercase">
          Scroll to zoom · drag to pan · click a row to jump
        </span>
        <Button variant="outline" size="sm" onClick={() => setSeed((s) => s + 1)}>
          Capture
        </Button>
      </div>
    </LogicAnalyzer>
  );
}
