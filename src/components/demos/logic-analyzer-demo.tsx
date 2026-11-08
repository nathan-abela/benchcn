import { type ReactElement, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { encodeI2c, type I2cTrace, type I2cTransaction } from "@/registry/benchcn/lib/decoders/i2c";
import { createRandom } from "@/registry/benchcn/lib/mock-device";
import { LogicAnalyzer, type LogicLane } from "@/registry/benchcn/ui/logic-analyzer/logic-analyzer";

const SAMPLE_RATE = 1_000_000;

type Random = () => number;

function bytes(rand: Random, count: number): number[] {
  return Array.from({ length: count }, () => Math.floor(rand() * 256));
}

function between(rand: Random, min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}

// Register addresses and lengths follow each part's datasheet so the decode reads like a real bus.
const DEVICES: ((rand: Random) => I2cTransaction[])[] = [
  (rand) => [
    { address: 0x76, read: false, data: [0xf7] },
    { address: 0x76, read: true, data: bytes(rand, 8), repeatedStart: true },
  ],
  () => [
    { address: 0x76, read: false, data: [0xd0] },
    { address: 0x76, read: true, data: [0x60], repeatedStart: true },
  ],
  (rand) => [{ address: 0x3c, read: false, data: [0x40, ...bytes(rand, between(rand, 2, 6))] }],
  () => [{ address: 0x3c, read: false, data: [0x00, 0xaf] }],
  (rand) => [{ address: 0x48, read: false, data: [0x01, 0xc3, between(rand, 0x80, 0x8f)] }],
  (rand) => [
    { address: 0x48, read: false, data: [0x00] },
    { address: 0x48, read: true, data: bytes(rand, 2), repeatedStart: true },
  ],
  (rand) => [
    { address: 0x50, read: false, data: [0x00, between(rand, 0, 255), ...bytes(rand, 4)] },
  ],
];

function captureTrace(seed: number): I2cTrace {
  const rand = createRandom(seed);
  const count = between(rand, 3, 6);
  const transactions = Array.from({ length: count }, () =>
    DEVICES[Math.floor(rand() * DEVICES.length)](rand),
  ).flat();
  return encodeI2c(transactions, {
    sampleRate: SAMPLE_RATE,
    clockHz: 100_000,
    gapSeconds: 0.0001 + rand() * 0.0004,
  });
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
    <LogicAnalyzer
      lanes={lanes}
      decode={{ protocol: "i2c", sda: "sda", scl: "scl" }}
      defaultWindow="first"
    >
      <div className="flex items-center justify-between gap-3 border-t pt-3">
        <span className="text-muted-foreground text-xs">
          Scroll to zoom, drag to pan, click a row to jump
        </span>
        <Button variant="outline" size="sm" onClick={() => setSeed((s) => s + 1)}>
          Capture
        </Button>
      </div>
    </LogicAnalyzer>
  );
}
