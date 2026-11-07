import { describe, expect, it } from "vitest";

import {
  decodeSpi,
  encodeSpi,
  formatSpiFrame,
  summarizeSpi,
  type SpiBitOrder,
  type SpiFrame,
  type SpiMode,
  type SpiTransaction,
} from "./spi";

const SAMPLE_RATE = 10_000_000;

const FLASH_READ_ID: SpiTransaction[] = [
  { mosi: [0x9f, 0x00, 0x00, 0x00], miso: [0x00, 0xef, 0x40, 0x18] },
  { mosi: [0x05, 0x00], miso: [0x00, 0x02] },
];

function withoutPositions(frames: SpiFrame[]): Omit<SpiFrame, "start" | "end">[] {
  return frames.map(({ start: _start, end: _end, ...rest }) => rest);
}

function risingEdges(levels: Uint8Array): number[] {
  const edges: number[] = [];
  for (let i = 1; i < levels.length; i += 1) {
    if (levels[i - 1] === 0 && levels[i] === 1) edges.push(i);
  }
  return edges;
}

function toTransactions(frames: SpiFrame[]): SpiTransaction[] {
  const transactions: SpiTransaction[] = [];
  for (const frame of frames) {
    if (frame.kind === "select") transactions.push({ mosi: [], miso: [] });
    else if (frame.kind === "byte") {
      const current = transactions[transactions.length - 1];
      current.mosi.push(frame.mosi ?? -1);
      current.miso?.push(frame.miso ?? -1);
    }
  }
  return transactions;
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

describe("encodeSpi", () => {
  it("should produce 10 samples per clock at 10 MHz with a 1 MHz clock", () => {
    // #given
    const trace = encodeSpi([{ mosi: [0xa5, 0x3c] }], { sampleRate: SAMPLE_RATE });

    // #when
    const edges = risingEdges(trace.sclk);
    const periods = edges.slice(1).map((edge, i) => edge - edges[i]);

    // #then 16 clocks for two bytes, spaced 10 samples apart
    expect(periods).toEqual(Array<number>(15).fill(10));
  });

  it("should assert CS before the first clock and release it after the last", () => {
    // #given
    const trace = encodeSpi([{ mosi: [0xa5] }], { sampleRate: SAMPLE_RATE });

    // #when
    const firstClock = trace.sclk.indexOf(1);
    const lastClock = trace.sclk.lastIndexOf(1);
    const csAsserted = trace.cs.indexOf(0);
    const csReleased = trace.cs.lastIndexOf(0) + 1;

    // #then
    expect([csAsserted < firstClock, lastClock < csReleased]).toEqual([true, true]);
  });
});

describe("decodeSpi", () => {
  it("should wrap each transaction in select and deselect frames", () => {
    // #given
    const trace = encodeSpi([{ mosi: [0xa5, 0x3c], miso: [0x00, 0xff] }], {
      sampleRate: SAMPLE_RATE,
    });

    // #when
    const frames = decodeSpi(trace);

    // #then
    expect(withoutPositions(frames)).toEqual([
      { kind: "select" },
      { kind: "byte", mosi: 0xa5, miso: 0x00 },
      { kind: "byte", mosi: 0x3c, miso: 0xff },
      { kind: "deselect" },
    ]);
  });

  const modes: SpiMode[] = [0, 1, 2, 3];
  const bitOrders: SpiBitOrder[] = ["msb", "lsb"];
  it.each(modes.flatMap((mode) => bitOrders.map((bitOrder) => [mode, bitOrder] as const)))(
    "should round-trip a flash read in mode %i, %s first",
    (mode, bitOrder) => {
      // #given
      const options = { mode, bitOrder };

      // #when
      const frames = decodeSpi(encodeSpi(FLASH_READ_ID, { sampleRate: SAMPLE_RATE, ...options }), {
        ...options,
      });

      // #then
      expect(toTransactions(frames)).toEqual(FLASH_READ_ID);
    },
  );

  it("should round-trip with an active-high chip select", () => {
    // #given
    const trace = encodeSpi(FLASH_READ_ID, { sampleRate: SAMPLE_RATE, csActiveLow: false });

    // #when
    const frames = decodeSpi(trace, { csActiveLow: false });

    // #then
    expect(toTransactions(frames)).toEqual(FLASH_READ_ID);
  });

  it("should decode continuously without a CS lane", () => {
    // #given
    const { sclk, mosi, sampleRate } = encodeSpi([{ mosi: [0x9f, 0x00] }], {
      sampleRate: SAMPLE_RATE,
    });

    // #when
    const frames = decodeSpi({ sclk, mosi, sampleRate });

    // #then
    expect(withoutPositions(frames)).toEqual([
      { kind: "byte", mosi: 0x9f },
      { kind: "byte", mosi: 0x00 },
    ]);
  });

  it("should combine two bytes into one word when the word size is 16", () => {
    // #given
    const trace = encodeSpi([{ mosi: [0xa5, 0x3c] }], { sampleRate: SAMPLE_RATE });

    // #when
    const frames = decodeSpi(trace, { wordSize: 16 });

    // #then
    expect(withoutPositions(frames)).toEqual([
      { kind: "select" },
      { kind: "byte", mosi: 0xa53c, miso: 0x0000 },
      { kind: "deselect" },
    ]);
  });

  it("should drop trailing bits that do not make a whole word", () => {
    // #given three clock pulses, then the capture ends
    const sclk = [0, 1, 0, 1, 0, 1, 0];
    const mosi = [1, 1, 1, 1, 1, 1, 1];

    // #when / #then
    expect(decodeSpi({ sclk, mosi, sampleRate: SAMPLE_RATE })).toEqual([]);
  });

  it("should return no frames for empty input", () => {
    // #when / #then
    expect(decodeSpi({ sclk: [], mosi: [], sampleRate: SAMPLE_RATE })).toEqual([]);
  });

  it("should round-trip seeded random transactions exactly", () => {
    // #given
    const random = seededRandom(0xcafe);
    const randomInt = (max: number): number => Math.floor(random() * max);
    const runs: SpiTransaction[][] = [];
    for (let run = 0; run < 25; run += 1) {
      const count = 1 + randomInt(4);
      runs.push(
        Array.from({ length: count }, () => {
          const length = 1 + randomInt(6);
          return {
            mosi: Array.from({ length }, () => randomInt(256)),
            miso: Array.from({ length }, () => randomInt(256)),
          };
        }),
      );
    }

    // #when
    const decoded = runs.map((transactions) =>
      toTransactions(decodeSpi(encodeSpi(transactions, { sampleRate: SAMPLE_RATE }))),
    );

    // #then
    expect(decoded).toEqual(runs);
  });
});

describe("formatSpiFrame", () => {
  it("should label chip select edges and bytes for the overlay", () => {
    // #given
    const frames: SpiFrame[] = [
      { kind: "select", start: 0, end: 1 },
      { kind: "deselect", start: 0, end: 1 },
      { kind: "byte", start: 0, end: 1, mosi: 0xa5 },
      { kind: "byte", start: 0, end: 1, mosi: 0xa5, miso: 0x00 },
      { kind: "byte", start: 0, end: 1, mosi: 0xa5, miso: 0x3c },
    ];

    // #when
    const labels = frames.map(formatSpiFrame);

    // #then
    expect(labels).toEqual(["CS", "/CS", "0xA5", "0xA5", "0xA5 / 0x3C"]);
  });
});

describe("summarizeSpi", () => {
  it("should print one line per selected burst with both lanes", () => {
    // #given
    const transactions: SpiTransaction[] = [
      { mosi: [0x0a, 0x1b], miso: [0x00, 0xff] },
      { mosi: [0x9f] },
    ];
    const frames = decodeSpi(encodeSpi(transactions, { sampleRate: SAMPLE_RATE }));

    // #when
    const summary = summarizeSpi(frames);

    // #then
    expect(summary).toBe("MOSI 0A 1B  MISO 00 FF\nMOSI 9F  MISO 00");
  });

  it("should omit MISO when no MISO lane was decoded", () => {
    // #given
    const frames: SpiFrame[] = [
      { kind: "byte", start: 0, end: 1, mosi: 0x0a },
      { kind: "byte", start: 1, end: 2, mosi: 0x1b },
    ];

    // #when
    const summary = summarizeSpi(frames);

    // #then
    expect(summary).toBe("MOSI 0A 1B");
  });
});
