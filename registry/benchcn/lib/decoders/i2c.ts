// benchcn.dev · decoders
// I²C encoder and decoder over two logic-level sample arrays (SDA, SCL). Pure, no DOM.

export type I2cFrameKind = "start" | "repeated-start" | "address" | "data" | "stop";

/**
 * `start` is inclusive and `end` exclusive, both sample indices into the input arrays.
 * Start/stop frames span the single sample where SDA changed. Address/data frames span from
 * the SCL falling edge before the first bit to one past the SCL rising edge that sampled ACK.
 */
export type I2cFrame = {
  kind: I2cFrameKind;
  start: number;
  end: number;
  value?: number;
  read?: boolean;
  ack?: boolean;
};

export type I2cTransaction = {
  address: number;
  read: boolean;
  data: number[];
  /** Follows the previous transaction with a repeated START instead of STOP + START. */
  repeatedStart?: boolean;
  /** NACK the last data byte. Defaults to true for reads (master ends the read), false for writes. */
  nackLast?: boolean;
};

export type I2cTrace = { sda: Uint8Array; scl: Uint8Array; sampleRate: number };

export type I2cEncodeOptions = {
  sampleRate: number;
  clockHz?: number;
  gapSeconds?: number;
  leadSeconds?: number;
};

type SampleSink = {
  sda: number[];
  scl: number[];
};

function emit(sink: SampleSink, sda: number, scl: number, count: number): void {
  for (let i = 0; i < count; i += 1) {
    sink.sda.push(sda);
    sink.scl.push(scl);
  }
}

export function encodeI2c(transactions: I2cTransaction[], options: I2cEncodeOptions): I2cTrace {
  const { sampleRate, clockHz = 100_000, gapSeconds = 0.0002, leadSeconds = 0.0001 } = options;
  const bitSamples = Math.max(2, Math.round(sampleRate / clockHz));
  const highSamples = Math.ceil(bitSamples / 2);
  const lowSamples = bitSamples - highSamples;
  const setupSamples = Math.floor(lowSamples / 2);
  const holdSamples = lowSamples - setupSamples;
  const gapSamples = Math.round(gapSeconds * sampleRate);
  const leadSamples = Math.round(leadSeconds * sampleRate);

  const sink: SampleSink = { sda: [], scl: [] };
  let sdaLevel = 1;

  const lowPhase = (bit: number): void => {
    emit(sink, sdaLevel, 0, setupSamples);
    sdaLevel = bit;
    emit(sink, bit, 0, holdSamples);
  };
  const clockBit = (bit: number): void => {
    lowPhase(bit);
    emit(sink, bit, 1, highSamples);
  };
  const startCondition = (): void => {
    sdaLevel = 0;
    emit(sink, 0, 1, highSamples);
  };
  const repeatedStartCondition = (): void => {
    lowPhase(1);
    emit(sink, 1, 1, highSamples);
    startCondition();
  };
  const stopCondition = (): void => {
    lowPhase(0);
    emit(sink, 0, 1, highSamples);
    sdaLevel = 1;
    emit(sink, 1, 1, highSamples);
  };
  const clockByte = (byte: number, ack: boolean): void => {
    for (let bit = 7; bit >= 0; bit -= 1) clockBit((byte >> bit) & 1);
    clockBit(ack ? 0 : 1);
  };

  emit(sink, 1, 1, leadSamples);

  transactions.forEach((transaction, index) => {
    const { address, read, data } = transaction;
    const nackLast = transaction.nackLast ?? read;
    if (index === 0) startCondition();
    else if (transaction.repeatedStart) repeatedStartCondition();
    else {
      emit(sink, 1, 1, gapSamples);
      startCondition();
    }

    clockByte(((address & 0x7f) << 1) | (read ? 1 : 0), true);
    data.forEach((byte, i) => {
      const last = i === data.length - 1;
      clockByte(byte & 0xff, !(last && nackLast));
    });

    const next = transactions[index + 1];
    if (!next?.repeatedStart) stopCondition();
  });

  emit(sink, 1, 1, leadSamples);

  return { sda: Uint8Array.from(sink.sda), scl: Uint8Array.from(sink.scl), sampleRate };
}

export function decodeI2c(trace: {
  sda: ArrayLike<number>;
  scl: ArrayLike<number>;
  sampleRate: number;
}): I2cFrame[] {
  const { sda, scl } = trace;
  const length = Math.min(sda.length, scl.length);
  const frames: I2cFrame[] = [];

  let inTransaction = false;
  let expectAddress = false;
  let bitCount = 0;
  let value = 0;
  let byteStart = 0;
  let lastFall = 0;

  const resetByte = (): void => {
    bitCount = 0;
    value = 0;
  };

  for (let i = 1; i < length; i += 1) {
    const prevSda = sda[i - 1];
    const prevScl = scl[i - 1];
    const curSda = sda[i];
    const curScl = scl[i];

    if (prevScl === 1 && curScl === 1) {
      if (prevSda === 1 && curSda === 0) {
        frames.push({ kind: inTransaction ? "repeated-start" : "start", start: i, end: i + 1 });
        inTransaction = true;
        expectAddress = true;
        resetByte();
      } else if (prevSda === 0 && curSda === 1 && inTransaction) {
        frames.push({ kind: "stop", start: i, end: i + 1 });
        inTransaction = false;
        resetByte();
      }
      continue;
    }

    if (prevScl === 1 && curScl === 0) {
      lastFall = i;
      continue;
    }

    if (prevScl === 0 && curScl === 1 && inTransaction) {
      if (bitCount === 0) byteStart = lastFall;
      if (bitCount < 8) {
        value = (value << 1) | (curSda === 0 ? 0 : 1);
        bitCount += 1;
        continue;
      }
      const ack = curSda === 0;
      if (expectAddress) {
        frames.push({
          kind: "address",
          start: byteStart,
          end: i + 1,
          value: value >> 1,
          read: (value & 1) === 1,
          ack,
        });
        expectAddress = false;
      } else {
        frames.push({ kind: "data", start: byteStart, end: i + 1, value, ack });
      }
      resetByte();
    }
  }

  return frames;
}

function hex2(value: number): string {
  return value.toString(16).toUpperCase().padStart(2, "0");
}

export function formatI2cFrame(frame: I2cFrame): string {
  switch (frame.kind) {
    case "start":
      return "S";
    case "repeated-start":
      return "Sr";
    case "stop":
      return "P";
    case "address":
      return `0x${hex2(frame.value ?? 0)} ${frame.read ? "R" : "W"}`;
    case "data":
      return `0x${hex2(frame.value ?? 0)}`;
  }
}

type SummaryTransaction = {
  address: number;
  read: boolean;
  ack: boolean;
  bytes: string[];
};

function formatSummary(transaction: SummaryTransaction): string {
  const direction = transaction.read ? "R" : "W";
  const head = `${direction} 0x${hex2(transaction.address)}${transaction.ack ? "" : " NAK"}`;
  return transaction.bytes.length > 0 ? `${head}: ${transaction.bytes.join(" ")}` : head;
}

export function summarizeI2c(frames: I2cFrame[]): string {
  const lines: string[] = [];
  let current: SummaryTransaction | undefined;

  const flush = (): void => {
    if (current) lines.push(formatSummary(current));
    current = undefined;
  };

  for (const frame of frames) {
    switch (frame.kind) {
      case "address":
        flush();
        current = {
          address: frame.value ?? 0,
          read: frame.read ?? false,
          ack: frame.ack ?? false,
          bytes: [],
        };
        break;
      case "data":
        if (!current) break;
        current.bytes.push(
          `${hex2(frame.value ?? 0)}${!current.read && frame.ack === false ? " NAK" : ""}`,
        );
        break;
      case "start":
      case "repeated-start":
      case "stop":
        flush();
        break;
    }
  }
  flush();

  return lines.join("\n");
}
