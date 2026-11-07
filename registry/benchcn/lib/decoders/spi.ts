// benchcn.dev · decoders
// SPI encoder and decoder over logic-level sample arrays (SCLK, MOSI, MISO, CS). Pure, no DOM.

/**
 * Mode = CPOL << 1 | CPHA. CPOL is the idle clock level. CPHA 0 samples on the leading edge of
 * each clock pulse (the first edge away from idle), CPHA 1 on the trailing edge.
 *
 * | Mode | CPOL | CPHA | Sampled on   |
 * | ---- | ---- | ---- | ------------ |
 * | 0    | 0    | 0    | rising edge  |
 * | 1    | 0    | 1    | falling edge |
 * | 2    | 1    | 0    | falling edge |
 * | 3    | 1    | 1    | rising edge  |
 */
export type SpiMode = 0 | 1 | 2 | 3;

export type SpiBitOrder = "msb" | "lsb";

/**
 * `start` is inclusive and `end` exclusive, both sample indices into the input arrays.
 * Select/deselect frames span the single sample where CS changed. Byte frames span from the
 * sampling edge of the first bit to one past the sampling edge of the last bit.
 */
export type SpiFrame = {
  kind: "select" | "byte" | "deselect";
  start: number;
  end: number;
  mosi?: number;
  miso?: number;
};

export type SpiTransaction = { mosi: number[]; miso?: number[] };

export type SpiTrace = {
  sclk: Uint8Array;
  mosi: Uint8Array;
  miso: Uint8Array;
  cs: Uint8Array;
  sampleRate: number;
};

export type SpiEncodeOptions = {
  sampleRate: number;
  clockHz?: number;
  mode?: SpiMode;
  bitOrder?: SpiBitOrder;
  csActiveLow?: boolean;
  gapSeconds?: number;
  leadSeconds?: number;
};

export type SpiDecodeOptions = {
  mode?: SpiMode;
  bitOrder?: SpiBitOrder;
  csActiveLow?: boolean;
  wordSize?: number;
};

type SampleSink = {
  sclk: number[];
  mosi: number[];
  miso: number[];
  cs: number[];
};

type Levels = { sclk: number; mosi: number; miso: number; cs: number };

function emit(sink: SampleSink, levels: Levels, count: number): void {
  for (let i = 0; i < count; i += 1) {
    sink.sclk.push(levels.sclk);
    sink.mosi.push(levels.mosi);
    sink.miso.push(levels.miso);
    sink.cs.push(levels.cs);
  }
}

function clockIdleLevel(mode: SpiMode): number {
  return mode >> 1;
}

function samplesOnTrailingEdge(mode: SpiMode): boolean {
  return (mode & 1) === 1;
}

function bitAt(value: number, index: number, bitOrder: SpiBitOrder, wordSize: number): number {
  const shift = bitOrder === "msb" ? wordSize - 1 - index : index;
  return (value >> shift) & 1;
}

export function encodeSpi(transactions: SpiTransaction[], options: SpiEncodeOptions): SpiTrace {
  const {
    sampleRate,
    clockHz = 1_000_000,
    mode = 0,
    bitOrder = "msb",
    csActiveLow = true,
    gapSeconds = 0.00001,
    leadSeconds = 0.000005,
  } = options;
  const bitSamples = Math.max(2, Math.round(sampleRate / clockHz));
  const firstHalf = Math.ceil(bitSamples / 2);
  const secondHalf = bitSamples - firstHalf;
  const gapSamples = Math.round(gapSeconds * sampleRate);
  const leadSamples = Math.round(leadSeconds * sampleRate);
  const idle = clockIdleLevel(mode);
  const active = 1 - idle;
  const trailing = samplesOnTrailingEdge(mode);
  const selected = csActiveLow ? 0 : 1;
  const deselected = 1 - selected;

  const sink: SampleSink = { sclk: [], mosi: [], miso: [], cs: [] };
  let mosiLevel = 0;
  let misoLevel = 0;

  const clockBit = (mosi: number, miso: number): void => {
    mosiLevel = mosi;
    misoLevel = miso;
    const leadingLevel = trailing ? active : idle;
    const trailingLevel = trailing ? idle : active;
    emit(sink, { sclk: leadingLevel, mosi, miso, cs: selected }, firstHalf);
    emit(sink, { sclk: trailingLevel, mosi, miso, cs: selected }, secondHalf);
  };
  const idleFor = (cs: number, count: number): void => {
    emit(sink, { sclk: idle, mosi: mosiLevel, miso: misoLevel, cs }, count);
  };

  idleFor(deselected, leadSamples);

  transactions.forEach((transaction, index) => {
    if (index > 0) idleFor(deselected, gapSamples);
    idleFor(selected, firstHalf);
    transaction.mosi.forEach((byte, i) => {
      const misoByte = transaction.miso?.[i] ?? 0;
      for (let bit = 0; bit < 8; bit += 1) {
        clockBit(bitAt(byte & 0xff, bit, bitOrder, 8), bitAt(misoByte & 0xff, bit, bitOrder, 8));
      }
    });
    idleFor(selected, firstHalf);
  });

  idleFor(deselected, leadSamples);

  return {
    sclk: Uint8Array.from(sink.sclk),
    mosi: Uint8Array.from(sink.mosi),
    miso: Uint8Array.from(sink.miso),
    cs: Uint8Array.from(sink.cs),
    sampleRate,
  };
}

export function decodeSpi(
  trace: {
    sclk: ArrayLike<number>;
    mosi: ArrayLike<number>;
    miso?: ArrayLike<number>;
    cs?: ArrayLike<number>;
    sampleRate: number;
  },
  options: SpiDecodeOptions = {},
): SpiFrame[] {
  const { mode = 0, bitOrder = "msb", csActiveLow = true, wordSize = 8 } = options;
  const { sclk, mosi, miso, cs } = trace;
  let length = Math.min(sclk.length, mosi.length);
  if (miso) length = Math.min(length, miso.length);
  if (cs) length = Math.min(length, cs.length);

  const idle = clockIdleLevel(mode);
  const sampledLevel = samplesOnTrailingEdge(mode) ? idle : 1 - idle;
  const selectedLevel = csActiveLow ? 0 : 1;
  const frames: SpiFrame[] = [];

  let selected = cs ? cs[0] === selectedLevel : true;
  let bitCount = 0;
  let mosiValue = 0;
  let misoValue = 0;
  let wordStart = 0;

  const resetWord = (): void => {
    bitCount = 0;
    mosiValue = 0;
    misoValue = 0;
  };
  const shiftIn = (value: number, bit: number): number =>
    bitOrder === "msb" ? (value << 1) | bit : value | (bit << bitCount);

  for (let i = 1; i < length; i += 1) {
    if (cs) {
      const nowSelected = cs[i] === selectedLevel;
      if (nowSelected !== selected) {
        frames.push({ kind: nowSelected ? "select" : "deselect", start: i, end: i + 1 });
        selected = nowSelected;
        resetWord();
        continue;
      }
    }
    if (!selected) continue;
    if (sclk[i - 1] === sclk[i] || sclk[i] !== sampledLevel) continue;

    if (bitCount === 0) wordStart = i;
    mosiValue = shiftIn(mosiValue, mosi[i] === 0 ? 0 : 1);
    if (miso) misoValue = shiftIn(misoValue, miso[i] === 0 ? 0 : 1);
    bitCount += 1;
    if (bitCount < wordSize) continue;

    const frame: SpiFrame = { kind: "byte", start: wordStart, end: i + 1, mosi: mosiValue };
    if (miso) frame.miso = misoValue;
    frames.push(frame);
    resetWord();
  }

  return frames;
}

function hex2(value: number): string {
  return value.toString(16).toUpperCase().padStart(2, "0");
}

export function formatSpiFrame(frame: SpiFrame): string {
  switch (frame.kind) {
    case "select":
      return "CS";
    case "deselect":
      return "/CS";
    case "byte": {
      const mosi = `0x${hex2(frame.mosi ?? 0)}`;
      return frame.miso ? `${mosi} / 0x${hex2(frame.miso)}` : mosi;
    }
  }
}

type SummaryBurst = { mosi: string[]; miso: string[] };

function formatBurst(burst: SummaryBurst): string {
  const head = `MOSI ${burst.mosi.join(" ")}`;
  return burst.miso.length > 0 ? `${head}  MISO ${burst.miso.join(" ")}` : head;
}

export function summarizeSpi(frames: SpiFrame[]): string {
  const lines: string[] = [];
  let current: SummaryBurst | undefined;

  const flush = (): void => {
    if (current && current.mosi.length > 0) lines.push(formatBurst(current));
    current = undefined;
  };

  for (const frame of frames) {
    switch (frame.kind) {
      case "select":
        flush();
        current = { mosi: [], miso: [] };
        break;
      case "byte":
        if (!current) current = { mosi: [], miso: [] };
        current.mosi.push(hex2(frame.mosi ?? 0));
        if (frame.miso !== undefined) current.miso.push(hex2(frame.miso));
        break;
      case "deselect":
        flush();
        break;
    }
  }
  flush();

  return lines.join("\n");
}
