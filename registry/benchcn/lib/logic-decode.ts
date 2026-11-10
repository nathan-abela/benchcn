// benchcn.dev · logic-analyzer
// Turns a decode request into what the analyzer draws: marks over one lane and a list of
// transactions. No DOM, so it is tested on its own.
import {
  decodeI2c,
  formatI2cFrame,
  type I2cFrame,
  summarizeI2c,
} from "@/registry/benchcn/lib/decoders/i2c";
import {
  decodeSpi,
  formatSpiFrame,
  type SpiDecodeOptions,
  type SpiFrame,
  summarizeSpi,
} from "@/registry/benchcn/lib/decoders/spi";
import {
  decodeUart,
  formatUartFrame,
  summarizeUart,
  type UartFrame,
  type UartOptions,
} from "@/registry/benchcn/lib/decoders/uart";

export type LogicSamples = {
  id: string;
  /** Logic levels, 0 or 1. */
  data: ArrayLike<number>;
  sampleRate: number;
};

/** Lane ids. */
export type I2cDecode = { protocol: "i2c"; sda: string; scl: string };

/** Lane ids, plus the decoder options. Leave `cs` out for a bus that is always selected. */
export type SpiDecode = SpiDecodeOptions & {
  protocol: "spi";
  sclk: string;
  mosi: string;
  miso?: string;
  cs?: string;
};

/** `rx` is the lane id of the serial line, whichever direction it carries. */
export type UartDecode = UartOptions & { protocol: "uart"; rx: string };

export type LogicDecode = I2cDecode | SpiDecode | UartDecode;

export type DecodeTone = "start" | "stop" | "address" | "data" | "error";

/** `start` is inclusive and `end` exclusive, both sample indices. */
export type DecodeMark = {
  start: number;
  end: number;
  shape: "dot" | "box";
  tone: DecodeTone;
  label: string;
  /** Used when `label` does not fit. */
  short?: string;
};

export type DecodedTransaction = {
  /** Seconds. */
  start: number;
  end: number;
  text: string;
};

export type DecodedLanes = {
  /** Id of the lane the marks are drawn above. */
  lane: string;
  sampleRate: number;
  marks: DecodeMark[];
  transactions: DecodedTransaction[];
};

type Span = { start: number; end: number };

function toTransactions<Frame extends Span>(
  groups: Frame[][],
  summarize: (frames: Frame[]) => string,
  sampleRate: number,
): DecodedTransaction[] {
  return groups
    .filter((group) => group.length > 0)
    .map((group) => ({
      start: group[0].start / sampleRate,
      end: group[group.length - 1].end / sampleRate,
      text: summarize(group).replaceAll("\n", " "),
    }))
    .filter((transaction) => transaction.text !== "");
}

function splitBefore<Frame>(
  frames: Frame[],
  opens: (frame: Frame, previous: Frame) => boolean,
): Frame[][] {
  const groups: Frame[][] = [];
  frames.forEach((frame, index) => {
    if (index === 0 || opens(frame, frames[index - 1])) groups.push([]);
    groups[groups.length - 1].push(frame);
  });
  return groups;
}

function i2cMark(frame: I2cFrame): DecodeMark {
  const { start, end } = frame;
  const label = formatI2cFrame(frame);
  switch (frame.kind) {
    case "start":
    case "repeated-start":
      return { start, end, shape: "dot", tone: "start", label: label[0] };
    case "stop":
      return { start, end, shape: "dot", tone: "stop", label };
    case "address":
    case "data":
      return {
        start,
        end,
        shape: "box",
        tone: frame.kind,
        label: frame.ack === false ? `${label} ✕` : label,
      };
  }
}

function spiMark(frame: SpiFrame): DecodeMark {
  const { start, end } = frame;
  if (frame.kind === "byte") {
    const label = formatSpiFrame(frame);
    return { start, end, shape: "box", tone: "data", label, short: label.split(" ")[0] };
  }
  return { start, end, shape: "dot", tone: frame.kind === "select" ? "start" : "stop", label: "" };
}

function uartMark(frame: UartFrame): DecodeMark {
  const { start, end } = frame;
  const tone = frame.kind === "error" ? "error" : "data";
  return { start, end, shape: "box", tone, label: formatUartFrame(frame) };
}

const LINE_FEED = 0x0a;
const CARRIAGE_RETURN = 0x0d;

/** The row break already says the line ended, so the line ending is left out of the text. */
function summarizeUartLine(frames: UartFrame[]): string {
  let end = frames.length;
  while (end > 0 && [LINE_FEED, CARRIAGE_RETURN].includes(frames[end - 1].value ?? -1)) end -= 1;
  return summarizeUart(frames.slice(0, end));
}

/** A new line of serial text starts after a line feed, or after the line sat idle for a frame. */
function splitUartLines(frames: UartFrame[]): UartFrame[][] {
  return splitBefore(
    frames,
    (frame, last) => last.value === LINE_FEED || frame.start - last.end > last.end - last.start,
  );
}

/** Runs the decoder named by `decode` over the lanes it points at. `null` when a lane is missing. */
export function decodeLanes(lanes: LogicSamples[], decode: LogicDecode): DecodedLanes | null {
  const find = (id: string | undefined): LogicSamples | undefined =>
    id === undefined ? undefined : lanes.find((lane) => lane.id === id);

  switch (decode.protocol) {
    case "i2c": {
      const sda = find(decode.sda);
      const scl = find(decode.scl);
      if (!sda || !scl) return null;
      const { sampleRate } = sda;
      const frames = decodeI2c({ sda: sda.data, scl: scl.data, sampleRate });
      const groups = splitBefore(
        frames,
        (frame) => frame.kind === "start" || frame.kind === "repeated-start",
      );
      return {
        lane: sda.id,
        sampleRate,
        marks: frames.map(i2cMark),
        transactions: toTransactions(groups, summarizeI2c, sampleRate),
      };
    }
    case "spi": {
      const sclk = find(decode.sclk);
      const mosi = find(decode.mosi);
      if (!sclk || !mosi) return null;
      const { sampleRate } = mosi;
      const frames = decodeSpi(
        {
          sclk: sclk.data,
          mosi: mosi.data,
          miso: find(decode.miso)?.data,
          cs: find(decode.cs)?.data,
          sampleRate,
        },
        decode,
      );
      const groups = splitBefore(frames, (frame) => frame.kind === "select");
      return {
        lane: mosi.id,
        sampleRate,
        marks: frames.map(spiMark),
        transactions: toTransactions(groups, summarizeSpi, sampleRate),
      };
    }
    case "uart": {
      const rx = find(decode.rx);
      if (!rx) return null;
      const { sampleRate } = rx;
      const frames = decodeUart({ data: rx.data, sampleRate }, decode);
      return {
        lane: rx.id,
        sampleRate,
        marks: frames.map(uartMark),
        transactions: toTransactions(splitUartLines(frames), summarizeUartLine, sampleRate),
      };
    }
  }
}
