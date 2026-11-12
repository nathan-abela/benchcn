// benchcn.dev · decoders
// Modbus RTU encoder and decoder over UART byte frames. Pure, no DOM.
// Every number here comes from two documents at modbus.org: the MODBUS over Serial Line
// Specification and Implementation Guide V1.02 ("serial" below) and the MODBUS Application
// Protocol Specification V1.1b3.
import {
  encodeUart,
  type UartFrame,
  type UartOptions,
  type UartParity,
  type UartTrace,
} from "@/registry/benchcn/lib/decoders/uart";

/** Serial line settings. Parity defaults to even. */
export type ModbusOptions = {
  baudRate: number;
  parity?: UartParity;
  /** Defaults to 2 without parity and 1 with it, so a character is always 11 bits. */
  stopBits?: 1 | 2;
  idleHigh?: boolean;
};

export type ModbusRole = "request" | "response";

/**
 * - `gap`: more than 1.5 character times of silence between two characters.
 * - `character`: a byte arrived with a UART framing or parity error.
 * - `crc`: the received CRC does not match the one computed over the frame.
 * - `short`: fewer than 4 bytes, so there is no address, function code and CRC to check.
 * - `length`: longer than 256 bytes, or the body does not fit the function code.
 */
export type ModbusError = "gap" | "character" | "crc" | "short" | "length";

/** PDU addresses start at zero: register 1 is address 0. */
export type ModbusPdu =
  | { kind: "read"; start: number; quantity: number }
  | { kind: "bits"; values: boolean[]; start?: number }
  | { kind: "registers"; values: number[]; start?: number }
  | { kind: "write-single"; address: number; value: number }
  | { kind: "write-bits"; start: number; quantity: number; values: boolean[] }
  | { kind: "write-registers"; start: number; quantity: number; values: number[] }
  | { kind: "written"; start: number; quantity: number }
  | { kind: "exception"; code: number }
  | { kind: "raw"; data: number[] };

type Span = { start: number; end: number };

/** `start` and `end` are sample indices from the UART frames. */
export type ModbusFrame = Span & {
  chars: UartFrame[];
  /** Silences longer than 1.5 characters inside the frame, as sample spans. */
  gaps: Span[];
  address?: number;
  /** As received, so an exception keeps its high bit set. */
  functionCode?: number;
  role?: ModbusRole;
  pdu?: ModbusPdu;
  crc?: { received: number; computed: number };
  errors: ModbusError[];
};

export type ModbusMessage = {
  address: number;
  /** Function code then data. */
  pdu: number[];
  /** Seconds of silence before the frame. Defaults to twice t3.5. */
  idle?: number;
  /** Sent in place of the computed CRC, to simulate a corrupted frame. */
  crc?: number;
};

export type ModbusEncodeOptions = ModbusOptions & { sampleRate: number };

export type ModbusTimings = {
  /** Seconds per character. */
  character: number;
  /** Longest silence allowed between two characters of one frame. */
  t15: number;
  /** Shortest silence that separates two frames. */
  t35: number;
};

export const MODBUS_EXCEPTIONS: Readonly<Record<number, string>> = {
  0x01: "Illegal function",
  0x02: "Illegal data address",
  0x03: "Illegal data value",
  0x04: "Server device failure",
  0x05: "Acknowledge",
  0x06: "Server device busy",
  0x08: "Memory parity error",
  0x0a: "Gateway path unavailable",
  0x0b: "Gateway target device failed to respond",
};

/** The public function codes this decoder parses. */
export const MODBUS_FUNCTIONS: Readonly<Record<number, string>> = {
  0x01: "Read coils",
  0x02: "Read discrete inputs",
  0x03: "Read holding registers",
  0x04: "Read input registers",
  0x05: "Write single coil",
  0x06: "Write single register",
  0x0f: "Write multiple coils",
  0x10: "Write multiple registers",
};

const EXCEPTION_BIT = 0x80;
const BROADCAST = 0;
const MAX_FRAME_BYTES = 256;
const MIN_FRAME_BYTES = 4;
const COIL_ON = 0xff00;
const COIL_OFF = 0x0000;
/** Above 19200 bps the guide fixes the timers instead of scaling them [serial 2.5.1.1]. */
const FIXED_TIMER_BAUD = 19_200;
const FIXED_T15 = 750e-6;
const FIXED_T35 = 1.75e-3;
/** Absorbs floating point error when a gap lands exactly on a timer; far below one sample. */
const EPSILON = 1e-9;

function stopBitsFor({ parity = "even", stopBits }: ModbusOptions): 1 | 2 {
  return stopBits ?? (parity === "none" ? 2 : 1);
}

export function modbusTimings(options: ModbusOptions): ModbusTimings {
  const { baudRate, parity = "even" } = options;
  const bits = 1 + 8 + (parity === "none" ? 0 : 1) + stopBitsFor(options);
  const character = bits / baudRate;
  if (baudRate > FIXED_TIMER_BAUD) return { character, t15: FIXED_T15, t35: FIXED_T35 };
  return { character, t15: 1.5 * character, t35: 3.5 * character };
}

/** The UART settings that carry these Modbus settings: always 8 data bits. */
export function modbusUartOptions(options: ModbusOptions): UartOptions {
  const { baudRate, parity = "even", idleHigh = true } = options;
  return { baudRate, dataBits: 8, parity, stopBits: stopBitsFor(options), idleHigh };
}

/** CRC-16 as in [serial 6.2.2]: register preset to 0xFFFF, shifted right, XORed with 0xA001. */
export function modbusCrc(bytes: ArrayLike<number>): number {
  let crc = 0xffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc ^= bytes[i] & 0xff;
    for (let shift = 0; shift < 8; shift += 1) {
      const lsb = crc & 1;
      crc >>= 1;
      if (lsb) crc ^= 0xa001;
    }
  }
  return crc;
}

/** Address, PDU, then the CRC with its low byte first. */
export function modbusAdu(address: number, pdu: number[], crc?: number): number[] {
  const body = [address & 0xff, ...pdu.map((byte) => byte & 0xff)];
  const check = crc ?? modbusCrc(body);
  return [...body, check & 0xff, (check >> 8) & 0xff];
}

export function encodeModbus(messages: ModbusMessage[], options: ModbusEncodeOptions): UartTrace {
  const { sampleRate, baudRate } = options;
  const uart = modbusUartOptions(options);
  const { t35 } = modbusTimings(options);
  const chunks = messages.map(
    (message) =>
      encodeUart(modbusAdu(message.address, message.pdu, message.crc), {
        ...uart,
        sampleRate,
        gapBits: 0,
        leadBits: (message.idle ?? 2 * t35) * baudRate,
      }).data,
  );
  const tail = Math.round(2 * t35 * sampleRate);
  const data = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0) + tail);
  data.fill(uart.idleHigh ? 1 : 0);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.length;
  }
  return { data, sampleRate };
}

/** Data words are big-endian, unlike the CRC. */
function word(data: number[], index: number): number {
  return (data[index] << 8) | data[index + 1];
}

function words(data: number[]): number[] {
  return Array.from({ length: data.length / 2 }, (_, index) => word(data, index * 2));
}

/** The low bit of the first byte is the first item. */
function unpackBits(data: number[]): boolean[] {
  return data.flatMap((byte) => Array.from({ length: 8 }, (_, bit) => ((byte >> bit) & 1) === 1));
}

function parseRequest(functionCode: number, data: number[]): ModbusPdu | null {
  switch (functionCode) {
    case 0x01:
    case 0x02:
    case 0x03:
    case 0x04:
      return data.length === 4
        ? { kind: "read", start: word(data, 0), quantity: word(data, 2) }
        : null;
    case 0x05:
    case 0x06:
      return data.length === 4
        ? { kind: "write-single", address: word(data, 0), value: word(data, 2) }
        : null;
    case 0x0f:
    case 0x10: {
      if (data.length < 5 || data.length !== 5 + data[4]) return null;
      const start = word(data, 0);
      const quantity = word(data, 2);
      const values = data.slice(5);
      if (functionCode === 0x0f) {
        return {
          kind: "write-bits",
          start,
          quantity,
          values: unpackBits(values).slice(0, quantity),
        };
      }
      return values.length % 2 === 0
        ? { kind: "write-registers", start, quantity, values: words(values) }
        : null;
    }
    default:
      return null;
  }
}

function parseResponse(functionCode: number, data: number[]): ModbusPdu | null {
  if (functionCode & EXCEPTION_BIT) {
    return data.length === 1 ? { kind: "exception", code: data[0] } : null;
  }
  switch (functionCode) {
    case 0x01:
    case 0x02:
      return data.length >= 1 && data.length === 1 + data[0]
        ? { kind: "bits", values: unpackBits(data.slice(1)) }
        : null;
    case 0x03:
    case 0x04:
      return data.length >= 1 && data.length === 1 + data[0] && data[0] % 2 === 0
        ? { kind: "registers", values: words(data.slice(1)) }
        : null;
    case 0x05:
    case 0x06:
      return parseRequest(functionCode, data);
    case 0x0f:
    case 0x10:
      return data.length === 4
        ? { kind: "written", start: word(data, 0), quantity: word(data, 2) }
        : null;
    default:
      return null;
  }
}

function isKnown(functionCode: number): boolean {
  return (functionCode & ~EXCEPTION_BIT) in MODBUS_FUNCTIONS;
}

/** A read response does not repeat what was asked for, so it borrows that from its request. */
function withRequest(pdu: ModbusPdu, request: ModbusPdu | undefined): ModbusPdu {
  if (request?.kind !== "read") return pdu;
  if (pdu.kind === "bits") {
    return { ...pdu, start: request.start, values: pdu.values.slice(0, request.quantity) };
  }
  if (pdu.kind === "registers") return { ...pdu, start: request.start };
  return pdu;
}

function splitFrames(
  chars: UartFrame[],
  sampleRate: number,
  timings: ModbusTimings,
): UartFrame[][] {
  const groups: UartFrame[][] = [];
  chars.forEach((char, index) => {
    const silence = index === 0 ? Infinity : (char.start - chars[index - 1].end) / sampleRate;
    if (silence >= timings.t35 - EPSILON) groups.push([]);
    groups[groups.length - 1].push(char);
  });
  return groups;
}

function inspect(chars: UartFrame[], sampleRate: number, timings: ModbusTimings): ModbusFrame {
  const gaps = chars.slice(1).flatMap((char, index) => {
    const previous = chars[index];
    const silence = (char.start - previous.end) / sampleRate;
    return silence > timings.t15 + EPSILON ? [{ start: previous.end, end: char.start }] : [];
  });
  const frame: ModbusFrame = {
    start: chars[0].start,
    end: chars[chars.length - 1].end,
    chars,
    gaps,
    errors: [],
  };
  if (gaps.length > 0) frame.errors.push("gap");
  if (chars.some((char) => char.kind === "error")) frame.errors.push("character");

  const values = chars.map((char) => char.value);
  if (values.some((value) => value === undefined)) return frame;
  const bytes = values as number[];
  if (bytes.length < MIN_FRAME_BYTES) {
    frame.errors.push("short");
    return frame;
  }
  if (bytes.length > MAX_FRAME_BYTES) frame.errors.push("length");

  const body = bytes.slice(0, -2);
  const received = bytes[bytes.length - 2] | (bytes[bytes.length - 1] << 8);
  const computed = modbusCrc(body);
  frame.crc = { received, computed };
  if (received !== computed) frame.errors.push("crc");
  frame.address = body[0];
  frame.functionCode = body[1];
  return frame;
}

/** Can `frame` answer `request`: same server, same function, or its exception. */
function answers(frame: ModbusFrame, request: ModbusFrame | undefined): boolean {
  return (
    request !== undefined &&
    frame.address === request.address &&
    ((frame.functionCode ?? 0) & ~EXCEPTION_BIT) === request.functionCode
  );
}

/**
 * Groups UART bytes into RTU frames, checks each CRC and parses the body.
 * Only the master starts a transaction and a server answers it with the same address and
 * function code, so a frame that fits both layouts is a response when it follows
 * an unanswered request it matches, and a request otherwise.
 */
export function decodeModbus(
  chars: UartFrame[],
  options: ModbusOptions & { sampleRate: number },
): ModbusFrame[] {
  const timings = modbusTimings(options);
  let pending: ModbusFrame | undefined;

  return splitFrames(chars, options.sampleRate, timings).map((group) => {
    const frame = inspect(group, options.sampleRate, timings);
    const { address, functionCode } = frame;
    if (address === undefined || functionCode === undefined) return frame;

    const data = frame.chars.slice(2, -2).map((char) => char.value ?? 0);
    const asRequest = parseRequest(functionCode, data);
    // A broadcast is never answered, so address 0 is always a request.
    const asResponse = address === BROADCAST ? null : parseResponse(functionCode, data);
    const matches = answers(frame, pending);
    const ask = (): void => {
      frame.role = "request";
      pending = address === BROADCAST ? undefined : frame;
    };

    if (asResponse && (!asRequest || matches)) {
      frame.role = "response";
      frame.pdu = matches ? withRequest(asResponse, pending?.pdu) : asResponse;
      pending = undefined;
    } else if (asRequest) {
      frame.pdu = asRequest;
      ask();
    } else {
      frame.pdu = { kind: "raw", data };
      if (isKnown(functionCode)) frame.errors.push("length");
      if (matches) {
        frame.role = "response";
        pending = undefined;
      } else if (!isKnown(functionCode)) {
        ask();
      }
    }
    return frame;
  });
}

export type ModbusFrameText = {
  address: string;
  role: string;
  function: string;
  detail: string;
  status: string;
};

const ERROR_TEXT: Record<ModbusError, string> = {
  gap: "gap over 1.5 chars",
  character: "bad character",
  crc: "CRC bad",
  short: "too short",
  length: "bad length",
};

function hex2(value: number): string {
  return value.toString(16).toUpperCase().padStart(2, "0");
}

function bitText(values: boolean[]): string {
  const digits = values.map((value) => (value ? "1" : "0")).join("");
  return digits.match(/.{1,8}/g)?.join(" ") ?? "";
}

function at(start: number | undefined, text: string): string {
  return start === undefined ? text : `${start}: ${text}`;
}

export function modbusFunctionName(functionCode: number): string {
  const base = functionCode & ~EXCEPTION_BIT;
  return MODBUS_FUNCTIONS[base] ?? `Function 0x${hex2(base)}`;
}

export function modbusExceptionName(code: number): string {
  return MODBUS_EXCEPTIONS[code] ?? "Unknown exception";
}

function detailOf(frame: ModbusFrame): string {
  const { pdu, functionCode } = frame;
  switch (pdu?.kind) {
    case undefined: {
      const bytes = frame.chars.flatMap((char) => (char.value === undefined ? [] : [char.value]));
      return bytes.length > 0 ? bytes.map(hex2).join(" ") : "--";
    }
    case "read":
    case "written":
      return `start ${pdu.start}, count ${pdu.quantity}`;
    case "bits":
      return at(pdu.start, bitText(pdu.values));
    case "registers":
      return at(pdu.start, pdu.values.join(" ") || "--");
    case "write-single": {
      if (functionCode !== 0x05) return `${pdu.address} = ${pdu.value}`;
      const state =
        pdu.value === COIL_ON
          ? "ON"
          : pdu.value === COIL_OFF
            ? "OFF"
            : `0x${pdu.value.toString(16)}`;
      return `${pdu.address} = ${state}`;
    }
    case "write-bits":
      return at(pdu.start, bitText(pdu.values));
    case "write-registers":
      return at(pdu.start, pdu.values.join(" "));
    case "exception":
      return `${hex2(pdu.code)} ${modbusExceptionName(pdu.code)}`;
    case "raw":
      return pdu.data.length > 0 ? pdu.data.map(hex2).join(" ") : "--";
  }
}

/** The frame as the columns of a frame list. Empty fields read `--`. */
export function describeModbusFrame(frame: ModbusFrame): ModbusFrameText {
  const { address, functionCode, role, crc, errors } = frame;
  const status = [
    ...(crc && !errors.includes("crc") ? ["CRC ok"] : []),
    ...errors.map((error) => ERROR_TEXT[error]),
  ];
  return {
    address: address === undefined ? "--" : address === BROADCAST ? "broadcast" : `addr ${address}`,
    role: role ?? "--",
    function: functionCode === undefined ? "--" : modbusFunctionName(functionCode),
    detail: detailOf(frame),
    status: status.join(", "),
  };
}

/** One line per frame. */
export function summarizeModbus(frames: ModbusFrame[]): string {
  return frames.map((frame) => Object.values(describeModbusFrame(frame)).join("  ")).join("\n");
}
