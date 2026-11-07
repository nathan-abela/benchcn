// benchcn.dev · decoders
// UART encoder and decoder over a single logic-level sample array. Pure, no DOM.

/**
 * `start` is inclusive and `end` exclusive, both sample indices into the input array.
 * Frames span from the start bit's falling edge to the nominal end of the last stop bit.
 * A parity error keeps the decoded `value` so the byte can still be shown.
 */
export type UartFrame = {
  kind: "byte" | "error";
  start: number;
  end: number;
  value?: number;
  error?: "framing" | "parity";
};

export type UartParity = "none" | "even" | "odd";

export type UartOptions = {
  baudRate: number;
  dataBits?: 5 | 6 | 7 | 8;
  parity?: UartParity;
  stopBits?: 1 | 2;
  idleHigh?: boolean;
};

export type UartTrace = { data: Uint8Array; sampleRate: number };

export type UartEncodeOptions = UartOptions & {
  sampleRate: number;
  gapBits?: number;
  leadBits?: number;
};

function parityBit(value: number, dataBits: number, parity: "even" | "odd"): number {
  let ones = 0;
  for (let bit = 0; bit < dataBits; bit += 1) ones += (value >> bit) & 1;
  const even = ones & 1;
  return parity === "even" ? even : 1 - even;
}

export function encodeUart(bytes: number[], options: UartEncodeOptions): UartTrace {
  const {
    baudRate,
    sampleRate,
    dataBits = 8,
    parity = "none",
    stopBits = 1,
    idleHigh = true,
    gapBits = 2,
    leadBits = 4,
  } = options;
  const samplesPerBit = sampleRate / baudRate;
  const mask = (1 << dataBits) - 1;
  const data: number[] = [];
  let elapsed = 0;

  const emitBits = (bit: number, count: number): void => {
    elapsed += samplesPerBit * count;
    const level = idleHigh ? bit : 1 - bit;
    const target = Math.round(elapsed);
    while (data.length < target) data.push(level);
  };

  emitBits(1, leadBits);
  for (const byte of bytes) {
    const value = byte & mask;
    emitBits(0, 1);
    for (let bit = 0; bit < dataBits; bit += 1) emitBits((value >> bit) & 1, 1);
    if (parity !== "none") emitBits(parityBit(value, dataBits, parity), 1);
    emitBits(1, stopBits + gapBits);
  }

  return { data: Uint8Array.from(data), sampleRate };
}

export function decodeUart(
  trace: { data: ArrayLike<number>; sampleRate: number },
  options: UartOptions,
): UartFrame[] {
  const { baudRate, dataBits = 8, parity = "none", stopBits = 1, idleHigh = true } = options;
  const { data, sampleRate } = trace;
  const samplesPerBit = sampleRate / baudRate;
  const idleLevel = idleHigh ? 1 : 0;
  const parityBits = parity === "none" ? 0 : 1;
  const firstStopBit = 1 + dataBits + parityBits;
  const frameBits = firstStopBit + stopBits;
  const frames: UartFrame[] = [];

  const centreOf = (start: number, bitIndex: number): number =>
    start + Math.round(samplesPerBit * (bitIndex + 0.5));

  for (let i = 1; i < data.length; i += 1) {
    if (data[i - 1] !== idleLevel || data[i] === idleLevel) continue;

    const start = i;
    const bits: number[] = [];
    for (let bitIndex = 0; bitIndex < frameBits; bitIndex += 1) {
      const sample = centreOf(start, bitIndex);
      if (sample >= data.length) return frames;
      bits.push(data[sample] === idleLevel ? 1 : 0);
    }
    if (bits[0] !== 0) continue;

    const end = start + Math.round(samplesPerBit * frameBits);
    const badStopBit = bits.findIndex((bit, index) => index >= firstStopBit && bit !== 1);
    if (badStopBit !== -1) {
      frames.push({ kind: "error", start, end, error: "framing" });
      i = centreOf(start, badStopBit);
      continue;
    }

    let value = 0;
    for (let bit = 0; bit < dataBits; bit += 1) value |= bits[1 + bit] << bit;
    const parityOk =
      parity === "none" || bits[firstStopBit - 1] === parityBit(value, dataBits, parity);
    frames.push(
      parityOk
        ? { kind: "byte", start, end, value }
        : { kind: "error", start, end, value, error: "parity" },
    );
    i = centreOf(start, frameBits - 1);
  }

  return frames;
}

function hex2(value: number): string {
  return value.toString(16).toUpperCase().padStart(2, "0");
}

function isPrintable(value: number): boolean {
  return value >= 0x20 && value <= 0x7e;
}

export function formatUartFrame(frame: UartFrame): string {
  if (frame.kind === "error") return `ERR ${frame.error ?? "framing"}`;
  const value = frame.value ?? 0;
  return isPrintable(value) ? `'${String.fromCharCode(value)}'` : `0x${hex2(value)}`;
}

export function summarizeUart(frames: UartFrame[]): string {
  return frames
    .map((frame) => {
      if (frame.kind === "error") return `<${frame.error ?? "framing"}>`;
      const value = frame.value ?? 0;
      return isPrintable(value) ? String.fromCharCode(value) : `<${hex2(value)}>`;
    })
    .join("");
}
