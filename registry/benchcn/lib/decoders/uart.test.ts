import { describe, expect, it } from "vitest";

import {
  decodeUart,
  encodeUart,
  formatUartFrame,
  summarizeUart,
  type UartFrame,
  type UartOptions,
} from "./uart";

const SAMPLE_RATE = 1_000_000;
const FAST_8N1: UartOptions = { baudRate: 100_000 };

function withoutPositions(frames: UartFrame[]): Omit<UartFrame, "start" | "end">[] {
  return frames.map(({ start: _start, end: _end, ...rest }) => rest);
}

function decodedBytes(frames: UartFrame[]): number[] {
  return frames.map((frame) => (frame.kind === "byte" ? (frame.value ?? -1) : -1));
}

function textBytes(text: string): number[] {
  return Array.from(text, (char) => char.charCodeAt(0));
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

describe("encodeUart", () => {
  it("should produce 10 samples per bit at 1 MHz and 100 kbaud", () => {
    // #given
    const trace = encodeUart([0x41], { ...FAST_8N1, sampleRate: SAMPLE_RATE });

    // #when / #then 4 lead + start + 8 data + stop + 2 gap bits
    expect(trace.data.length).toBe(160);
  });

  it("should keep 9600 baud at 1 MHz within one sample over a frame", () => {
    // #given
    const trace = encodeUart([0x41], {
      baudRate: 9600,
      sampleRate: SAMPLE_RATE,
      leadBits: 0,
      gapBits: 0,
    });

    // #when / #then 10 bits at 104.1667 samples each
    expect(trace.data.length).toBe(1042);
  });
});

describe("decodeUart", () => {
  it.each<[string, UartOptions]>([
    ["8N1", { baudRate: 100_000 }],
    ["7E1", { baudRate: 100_000, dataBits: 7, parity: "even" }],
    ["8O2", { baudRate: 100_000, parity: "odd", stopBits: 2 }],
    ["5N1", { baudRate: 100_000, dataBits: 5 }],
    ["8N1 inverted", { baudRate: 100_000, idleHigh: false }],
  ])("should round-trip bytes as %s", (_label, options) => {
    // #given
    const mask = (1 << (options.dataBits ?? 8)) - 1;
    const bytes = [0x00, 0x55, 0xaa, 0xff, 0x41, 0x1f].map((byte) => byte & mask);

    // #when
    const frames = decodeUart(encodeUart(bytes, { ...options, sampleRate: SAMPLE_RATE }), options);

    // #then
    expect(decodedBytes(frames)).toEqual(bytes);
  });

  it("should round-trip 64 random bytes at 9600 baud sampled at 1 MHz", () => {
    // #given
    const random = seededRandom(0x9600);
    const bytes = Array.from({ length: 64 }, () => Math.floor(random() * 256));
    const options: UartOptions = { baudRate: 9600 };

    // #when
    const frames = decodeUart(encodeUart(bytes, { ...options, sampleRate: SAMPLE_RATE }), options);

    // #then
    expect(decodedBytes(frames)).toEqual(bytes);
  });

  it("should report a framing error and still decode the following byte", () => {
    // #given the first byte's stop bit (samples 130-139) forced low
    const trace = encodeUart([0x41, 0x42], { ...FAST_8N1, sampleRate: SAMPLE_RATE });
    trace.data.fill(0, 130, 140);

    // #when
    const frames = decodeUart(trace, FAST_8N1);

    // #then
    expect(withoutPositions(frames)).toEqual([
      { kind: "error", error: "framing" },
      { kind: "byte", value: 0x42 },
    ]);
  });

  it("should report a parity error and keep the decoded value", () => {
    // #given 0x41 has even parity, so its parity bit (samples 130-139) is forced high
    const options: UartOptions = { baudRate: 100_000, parity: "even" };
    const trace = encodeUart([0x41], { ...options, sampleRate: SAMPLE_RATE });
    trace.data.fill(1, 130, 140);

    // #when
    const frames = decodeUart(trace, options);

    // #then
    expect(frames).toEqual([{ kind: "error", start: 40, end: 150, value: 0x41, error: "parity" }]);
  });

  it("should return no frames for empty input", () => {
    // #when / #then
    expect(decodeUart({ data: [], sampleRate: SAMPLE_RATE }, FAST_8N1)).toEqual([]);
  });

  it("should return no frames for an idle line", () => {
    // #given
    const idle = new Uint8Array(500).fill(1);

    // #when / #then
    expect(decodeUart({ data: idle, sampleRate: SAMPLE_RATE }, FAST_8N1)).toEqual([]);
  });
});

describe("formatUartFrame", () => {
  it("should label printable bytes, hex bytes and errors for the overlay", () => {
    // #given
    const frames: UartFrame[] = [
      { kind: "byte", start: 0, end: 1, value: 0x68 },
      { kind: "byte", start: 0, end: 1, value: 0x0a },
      { kind: "error", start: 0, end: 1, error: "framing" },
      { kind: "error", start: 0, end: 1, value: 0x41, error: "parity" },
    ];

    // #when
    const labels = frames.map(formatUartFrame);

    // #then
    expect(labels).toEqual(["'h'", "0x0A", "ERR framing", "ERR parity"]);
  });
});

describe("summarizeUart", () => {
  it("should print decoded text as is", () => {
    // #given
    const frames = decodeUart(
      encodeUart(textBytes("hello"), { ...FAST_8N1, sampleRate: SAMPLE_RATE }),
      FAST_8N1,
    );

    // #when / #then
    expect(summarizeUart(frames)).toBe("hello");
  });

  it("should escape control bytes and errors", () => {
    // #given
    const frames: UartFrame[] = [
      { kind: "byte", start: 0, end: 1, value: 0x4f },
      { kind: "byte", start: 0, end: 1, value: 0x4b },
      { kind: "byte", start: 0, end: 1, value: 0x0d },
      { kind: "error", start: 0, end: 1, error: "framing" },
    ];

    // #when / #then
    expect(summarizeUart(frames)).toBe("OK<0D><framing>");
  });
});
