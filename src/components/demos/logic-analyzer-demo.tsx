import { type ReactElement, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { encodeI2c, type I2cTransaction } from "@/registry/benchcn/lib/decoders/i2c";
import { encodeSpi, type SpiTransaction } from "@/registry/benchcn/lib/decoders/spi";
import { encodeUart } from "@/registry/benchcn/lib/decoders/uart";
import { createRandom } from "@/registry/benchcn/lib/mock-device";
import {
  LogicAnalyzer,
  type LogicDecode,
  type LogicLane,
} from "@/registry/benchcn/ui/logic-analyzer/logic-analyzer";

const SAMPLE_RATE = 1_000_000;
const BAUD_RATE = 115_200;

type Random = () => number;
type Protocol = LogicDecode["protocol"];
type Capture = { lanes: LogicLane[]; decode: LogicDecode };

function bytes(rand: Random, count: number): number[] {
  return Array.from({ length: count }, () => Math.floor(rand() * 256));
}

function between(rand: Random, min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}

function pick<T>(rand: Random, from: T[], min: number, max: number): T[] {
  return Array.from(
    { length: between(rand, min, max) },
    () => from[Math.floor(rand() * from.length)],
  );
}

function lane(id: string, data: Uint8Array): LogicLane {
  return { id, label: id.toUpperCase(), data, sampleRate: SAMPLE_RATE };
}

// Register addresses and lengths follow each part's datasheet so the decode reads like a real bus.
const I2C_DEVICES: ((rand: Random) => I2cTransaction[])[] = [
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

// The common SPI NOR flash commands: read JEDEC ID, write enable, read status, read data.
const SPI_COMMANDS: ((rand: Random) => SpiTransaction)[] = [
  () => ({ mosi: [0x9f, 0x00, 0x00, 0x00], miso: [0x00, 0xef, 0x40, 0x18] }),
  () => ({ mosi: [0x06] }),
  (rand) => ({ mosi: [0x05, 0x00], miso: [0x00, between(rand, 0, 3)] }),
  (rand) => {
    const count = between(rand, 2, 5);
    return {
      mosi: [0x03, 0x00, between(rand, 0, 255), 0x00, ...Array<number>(count).fill(0)],
      miso: [0, 0, 0, 0, ...bytes(rand, count)],
    };
  },
];

const UART_LINES: ((rand: Random) => string)[] = [
  () => "boot ok\n",
  (rand) => `temp=${(20 + rand() * 8).toFixed(1)}\n`,
  (rand) => `rssi=-${between(rand, 48, 82)}\n`,
  (rand) => `adc0=${between(rand, 0, 4095)}\n`,
  () => "wifi up\n",
];

function capture(protocol: Protocol, seed: number): Capture {
  const rand = createRandom(seed);
  const gapSeconds = 0.0001 + rand() * 0.0004;

  switch (protocol) {
    case "i2c": {
      const transactions = pick(rand, I2C_DEVICES, 3, 6).flatMap((device) => device(rand));
      const trace = encodeI2c(transactions, {
        sampleRate: SAMPLE_RATE,
        clockHz: 100_000,
        gapSeconds,
      });
      return {
        lanes: [lane("scl", trace.scl), lane("sda", trace.sda)],
        decode: { protocol, sda: "sda", scl: "scl" },
      };
    }
    case "spi": {
      const transactions = pick(rand, SPI_COMMANDS, 3, 5).map((command) => command(rand));
      const trace = encodeSpi(transactions, {
        sampleRate: SAMPLE_RATE,
        clockHz: 100_000,
        gapSeconds,
      });
      return {
        lanes: [
          lane("cs", trace.cs),
          lane("sclk", trace.sclk),
          lane("mosi", trace.mosi),
          lane("miso", trace.miso),
        ],
        decode: { protocol, sclk: "sclk", mosi: "mosi", miso: "miso", cs: "cs" },
      };
    }
    case "uart": {
      const text = pick(rand, UART_LINES, 3, 5)
        .map((line) => line(rand))
        .join("");
      const trace = encodeUart(
        Array.from(text, (char) => char.charCodeAt(0)),
        { sampleRate: SAMPLE_RATE, baudRate: BAUD_RATE },
      );
      return {
        lanes: [lane("rx", trace.data)],
        decode: { protocol, rx: "rx", baudRate: BAUD_RATE },
      };
    }
  }
}

const PROTOCOLS: { id: Protocol; label: string }[] = [
  { id: "i2c", label: "I2C" },
  { id: "spi", label: "SPI" },
  { id: "uart", label: "UART" },
];

export function LogicAnalyzerDemo(): ReactElement {
  const [protocol, setProtocol] = useState<Protocol>("i2c");
  const [seed, setSeed] = useState(1);
  const { lanes, decode } = useMemo(() => capture(protocol, seed), [protocol, seed]);

  return (
    <LogicAnalyzer lanes={lanes} decode={decode} defaultWindow="first">
      <div className="flex items-center justify-between gap-3 border-t pt-3">
        <div className="flex items-center gap-1">
          {PROTOCOLS.map(({ id, label }) => (
            <Button
              key={id}
              variant={id === protocol ? "secondary" : "ghost"}
              size="sm"
              aria-pressed={id === protocol}
              onClick={() => setProtocol(id)}
            >
              {label}
            </Button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => setSeed((s) => s + 1)}>
          Capture
        </Button>
      </div>
    </LogicAnalyzer>
  );
}
