import { describe, expect, it } from "vitest";

import {
  decodeI2c,
  encodeI2c,
  formatI2cFrame,
  summarizeI2c,
  type I2cFrame,
  type I2cTransaction,
} from "./i2c";

const SAMPLE_RATE = 1_000_000;

const BME280_READ: I2cTransaction[] = [
  { address: 0x76, read: false, data: [0xf7] },
  {
    address: 0x76,
    read: true,
    data: [0x80, 0x00, 0x00, 0x7f, 0x9e, 0x00, 0x6b, 0x2e],
    repeatedStart: true,
  },
];

function withoutPositions(frames: I2cFrame[]): Omit<I2cFrame, "start" | "end">[] {
  return frames.map(({ start: _start, end: _end, ...rest }) => rest);
}

function risingEdges(levels: Uint8Array): number[] {
  const edges: number[] = [];
  for (let i = 1; i < levels.length; i += 1) {
    if (levels[i - 1] === 0 && levels[i] === 1) edges.push(i);
  }
  return edges;
}

function toTransactions(frames: I2cFrame[]): I2cTransaction[] {
  const transactions: I2cTransaction[] = [];
  let previous: I2cFrame | undefined;
  for (const frame of frames) {
    if (frame.kind === "address") {
      transactions.push({
        address: frame.value ?? -1,
        read: frame.read ?? false,
        data: [],
        repeatedStart: previous?.kind === "repeated-start",
        nackLast: false,
      });
    } else if (frame.kind === "data") {
      const current = transactions[transactions.length - 1];
      current.data.push(frame.value ?? -1);
      current.nackLast = frame.ack === false;
    }
    previous = frame;
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

describe("encodeI2c", () => {
  it("should produce 10 samples per bit at 1 MHz with a 100 kHz clock", () => {
    // #given
    const trace = encodeI2c([{ address: 0x50, read: false, data: [0xa5] }], {
      sampleRate: SAMPLE_RATE,
    });

    // #when
    const edges = risingEdges(trace.scl);
    const periods = edges.slice(1).map((edge, i) => edge - edges[i]);

    // #then 18 clocks (two bytes with ACK) plus the STOP's SCL rise, spaced 10 samples apart
    expect(periods).toEqual(Array<number>(18).fill(10));
  });
});

describe("decodeI2c", () => {
  it("should decode a single write as start, address, data, stop", () => {
    // #given
    const trace = encodeI2c([{ address: 0x76, read: false, data: [0xf7] }], {
      sampleRate: SAMPLE_RATE,
    });

    // #when
    const frames = decodeI2c(trace);

    // #then
    expect(withoutPositions(frames)).toEqual([
      { kind: "start" },
      { kind: "address", value: 0x76, read: false, ack: true },
      { kind: "data", value: 0xf7, ack: true },
      { kind: "stop" },
    ]);
  });

  it("should decode a write followed by a repeated-start read with the last byte NACKed", () => {
    // #given
    const trace = encodeI2c(BME280_READ, { sampleRate: SAMPLE_RATE });

    // #when
    const frames = decodeI2c(trace);

    // #then
    expect(withoutPositions(frames)).toEqual([
      { kind: "start" },
      { kind: "address", value: 0x76, read: false, ack: true },
      { kind: "data", value: 0xf7, ack: true },
      { kind: "repeated-start" },
      { kind: "address", value: 0x76, read: true, ack: true },
      { kind: "data", value: 0x80, ack: true },
      { kind: "data", value: 0x00, ack: true },
      { kind: "data", value: 0x00, ack: true },
      { kind: "data", value: 0x7f, ack: true },
      { kind: "data", value: 0x9e, ack: true },
      { kind: "data", value: 0x00, ack: true },
      { kind: "data", value: 0x6b, ack: true },
      { kind: "data", value: 0x2e, ack: false },
      { kind: "stop" },
    ]);
  });

  it("should round-trip seeded random transactions exactly", () => {
    // #given
    const random = seededRandom(0xbeef);
    const randomInt = (max: number): number => Math.floor(random() * max);
    const runs: I2cTransaction[][] = [];
    for (let run = 0; run < 25; run += 1) {
      const count = 1 + randomInt(4);
      const transactions: I2cTransaction[] = [];
      for (let t = 0; t < count; t += 1) {
        const read = random() < 0.5;
        transactions.push({
          address: randomInt(128),
          read,
          data: Array.from({ length: randomInt(6) + 1 }, () => randomInt(256)),
          repeatedStart: t > 0 && random() < 0.5,
          nackLast: read,
        });
      }
      runs.push(transactions);
    }

    // #when
    const decoded = runs.map((transactions) =>
      toTransactions(decodeI2c(encodeI2c(transactions, { sampleRate: SAMPLE_RATE }))),
    );

    // #then
    expect(decoded).toEqual(runs);
  });

  it("should return no frames for empty input", () => {
    // #when / #then
    expect(decodeI2c({ sda: [], scl: [], sampleRate: SAMPLE_RATE })).toEqual([]);
  });

  it("should return no frames for an idle bus", () => {
    // #given
    const idle = new Uint8Array(200).fill(1);

    // #when / #then
    expect(decodeI2c({ sda: idle, scl: idle, sampleRate: SAMPLE_RATE })).toEqual([]);
  });

  it("should return only the start frame when the byte is incomplete", () => {
    // #given a START followed by two clocks, then the capture ends
    const sda = [1, 1, 0, 0, 0, 1, 1, 1];
    const scl = [1, 1, 1, 0, 1, 0, 1, 0];

    // #when
    const frames = decodeI2c({ sda, scl, sampleRate: SAMPLE_RATE });

    // #then
    expect(frames).toEqual([{ kind: "start", start: 2, end: 3 }]);
  });
});

describe("formatI2cFrame", () => {
  it("should label bus conditions and bytes for the overlay", () => {
    // #given
    const frames: I2cFrame[] = [
      { kind: "start", start: 0, end: 1 },
      { kind: "repeated-start", start: 0, end: 1 },
      { kind: "stop", start: 0, end: 1 },
      { kind: "address", start: 0, end: 1, value: 0x76, read: false, ack: true },
      { kind: "address", start: 0, end: 1, value: 0x0a, read: true, ack: false },
      { kind: "data", start: 0, end: 1, value: 0xf7, ack: false },
    ];

    // #when
    const labels = frames.map(formatI2cFrame);

    // #then
    expect(labels).toEqual(["S", "Sr", "P", "0x76 W", "0x0A R", "0xF7"]);
  });
});

describe("summarizeI2c", () => {
  it("should print one line per transaction for a BME280 burst read", () => {
    // #given
    const frames = decodeI2c(encodeI2c(BME280_READ, { sampleRate: SAMPLE_RATE }));

    // #when
    const summary = summarizeI2c(frames);

    // #then
    expect(summary).toBe("W 0x76: F7\nR 0x76: 80 00 00 7F 9E 00 6B 2E");
  });

  it("should flag unexpected NACKs on addresses and written bytes", () => {
    // #given
    const frames: I2cFrame[] = [
      { kind: "start", start: 0, end: 1 },
      { kind: "address", start: 0, end: 1, value: 0x3c, read: false, ack: false },
      { kind: "stop", start: 0, end: 1 },
      { kind: "start", start: 0, end: 1 },
      { kind: "address", start: 0, end: 1, value: 0x68, read: false, ack: true },
      { kind: "data", start: 0, end: 1, value: 0x6b, ack: true },
      { kind: "data", start: 0, end: 1, value: 0x00, ack: false },
      { kind: "stop", start: 0, end: 1 },
    ];

    // #when
    const summary = summarizeI2c(frames);

    // #then
    expect(summary).toBe("W 0x3C NAK\nW 0x68: 6B 00 NAK");
  });
});
