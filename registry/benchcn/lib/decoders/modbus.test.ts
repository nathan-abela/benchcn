import { describe, expect, it } from "vitest";

import {
  decodeModbus,
  describeModbusFrame,
  encodeModbus,
  type ModbusFrame,
  type ModbusOptions,
  modbusAdu,
  modbusCrc,
  modbusExceptionName,
  modbusTimings,
  summarizeModbus,
} from "./modbus";
import { decodeUart, type UartFrame } from "./uart";

// 9600 baud sampled at 960 kHz gives exactly 100 samples per bit and 1100 per 11-bit character,
// so silences land on the 1.5 and 3.5 character timers without rounding.
const RATE_9600 = 960_000;
const CHAR = 1100;
const SLOW: ModbusOptions & { sampleRate: number } = { baudRate: 9600, sampleRate: RATE_9600 };

/** UART characters with `silences[i]` samples of idle line before byte `i + 1`. */
function chars(bytes: number[], silences: number[] = []): UartFrame[] {
  let position = 0;
  return bytes.map((value, index) => {
    if (index > 0) position += silences[index - 1] ?? 0;
    const frame: UartFrame = { kind: "byte", start: position, end: position + CHAR, value };
    position += CHAR;
    return frame;
  });
}

/** Whole ADUs, each separated by four characters of silence. */
function frames(...adus: number[][]): UartFrame[] {
  const bytes = adus.flat();
  const silences: number[] = [];
  adus.forEach((adu, index) => {
    silences.push(...Array<number>(adu.length - 1).fill(0));
    if (index < adus.length - 1) silences.push(4 * CHAR);
  });
  return chars(bytes, silences);
}

function decodeAdus(...adus: number[][]): ModbusFrame[] {
  return decodeModbus(frames(...adus), SLOW);
}

describe("modbusCrc", () => {
  it("should match the worked example in the serial line spec", () => {
    // #given frame 02 07, whose register ends at 0001 0010 0100 0001 [serial 6.2.2]
    const bytes = [0x02, 0x07];

    // #when / #then
    expect(modbusCrc(bytes)).toBe(0x1241);
  });

  it("should append the low-order byte first, so the example goes out as 41 12", () => {
    // #when / #then [serial 6.2.2, figure 30]
    expect(modbusAdu(0x02, [0x07])).toEqual([0x02, 0x07, 0x41, 0x12]);
  });

  it("should leave a zero register after running over a frame and its CRC", () => {
    // #given
    const adu = modbusAdu(0x01, [0x03, 0x00, 0x6b, 0x00, 0x03]);

    // #when / #then
    expect(modbusCrc(adu)).toBe(0);
  });

  it("should flag a frame whose CRC does not match", () => {
    // #given
    const adu = modbusAdu(0x01, [0x03, 0x00, 0x6b, 0x00, 0x03], 0x1234);

    // #when
    const [frame] = decodeAdus(adu);

    // #then
    expect(frame.errors).toEqual(["crc"]);
  });

  it("should flag a frame with one corrupted data byte", () => {
    // #given
    const adu = modbusAdu(0x01, [0x06, 0x00, 0x01, 0x00, 0x03]);
    adu[5] ^= 0x01;

    // #when
    const [frame] = decodeAdus(adu);

    // #then
    expect(frame.errors).toEqual(["crc"]);
  });
});

describe("modbusTimings", () => {
  it("should scale the timers with an 11-bit character at 9600 baud", () => {
    // #when
    const timings = modbusTimings({ baudRate: 9600 });

    // #then
    expect(timings).toEqual({
      character: 11 / 9600,
      t15: 1.5 * (11 / 9600),
      t35: 3.5 * (11 / 9600),
    });
  });

  it("should add a second stop bit without parity so the character stays 11 bits", () => {
    // #when / #then [serial 2.5.1]
    expect(modbusTimings({ baudRate: 9600, parity: "none" }).character).toBe(11 / 9600);
  });

  it("should still scale the timers at exactly 19200 baud", () => {
    // #when / #then
    expect(modbusTimings({ baudRate: 19_200 }).t35).toBe(3.5 * (11 / 19_200));
  });

  it("should use the fixed 750 us and 1.750 ms timers above 19200 baud", () => {
    // #when
    const { t15, t35 } = modbusTimings({ baudRate: 115_200 });

    // #then [serial 2.5.1.1]
    expect({ t15, t35 }).toEqual({ t15: 750e-6, t35: 1.75e-3 });
  });
});

describe("decodeModbus framing", () => {
  const adu = modbusAdu(0x01, [0x06, 0x00, 0x01, 0x00, 0x03]);

  it("should start a new frame after exactly 3.5 characters of silence", () => {
    // #given
    const input = chars([...adu, ...adu], [...Array<number>(7).fill(0), 3.5 * CHAR]);

    // #when / #then
    expect(decodeModbus(input, SLOW)).toHaveLength(2);
  });

  it("should keep one frame when the silence is a sample short of 3.5 characters", () => {
    // #given
    const input = chars([...adu, ...adu], [...Array<number>(7).fill(0), 3.5 * CHAR - 1]);

    // #when / #then
    expect(decodeModbus(input, SLOW)).toHaveLength(1);
  });

  it("should accept exactly 1.5 characters of silence inside a frame", () => {
    // #given
    const input = chars(adu, [0, 0, 1.5 * CHAR, 0, 0, 0, 0]);

    // #when
    const [frame] = decodeModbus(input, SLOW);

    // #then
    expect(frame.errors).toEqual([]);
  });

  it("should flag a silence of more than 1.5 characters inside a frame", () => {
    // #given
    const input = chars(adu, [0, 0, 1.5 * CHAR + 1, 0, 0, 0, 0]);

    // #when
    const [frame] = decodeModbus(input, SLOW);

    // #then
    expect({ errors: frame.errors, gaps: frame.gaps }).toEqual({
      errors: ["gap"],
      gaps: [{ start: 3 * CHAR, end: 4.5 * CHAR + 1 }],
    });
  });

  it("should split at the fixed 1.750 ms above 19200 baud", () => {
    // #given 1 MHz sampling, so 1750 samples is 1.750 ms
    const input = chars([...adu, ...adu], [...Array<number>(7).fill(0), 1750]);

    // #when / #then
    expect(decodeModbus(input, { baudRate: 115_200, sampleRate: 1_000_000 })).toHaveLength(2);
  });

  it("should not split a sample short of the fixed 1.750 ms", () => {
    // #given
    const input = chars([...adu, ...adu], [...Array<number>(7).fill(0), 1749]);

    // #when / #then
    expect(decodeModbus(input, { baudRate: 115_200, sampleRate: 1_000_000 })).toHaveLength(1);
  });

  it("should flag a frame shorter than address, function and CRC", () => {
    // #given
    const [frame] = decodeModbus(chars([0x01, 0x03, 0x00]), SLOW);

    // #then
    expect(frame.errors).toEqual(["short"]);
  });

  it("should flag a frame longer than 256 bytes", () => {
    // #given
    const oversized = modbusAdu(0x01, [0x2b, ...Array<number>(254).fill(0)]);

    // #when
    const [frame] = decodeAdus(oversized);

    // #then
    expect(frame.errors).toEqual(["length"]);
  });

  it("should flag a character with a UART error and skip the parse", () => {
    // #given
    const input = chars(adu);
    input[3] = { kind: "error", start: input[3].start, end: input[3].end, error: "framing" };

    // #when
    const [frame] = decodeModbus(input, SLOW);

    // #then
    expect({ errors: frame.errors, pdu: frame.pdu }).toEqual({
      errors: ["character"],
      pdu: undefined,
    });
  });
});

describe("decodeModbus function codes", () => {
  // Request and response PDUs are the examples printed in [app 6.x].
  it("should parse 01 Read coils and trim the response to the requested quantity", () => {
    // #when
    const [request, response] = decodeAdus(
      modbusAdu(1, [0x01, 0x00, 0x13, 0x00, 0x13]),
      modbusAdu(1, [0x01, 0x03, 0xcd, 0x6b, 0x05]),
    );

    // #then
    expect([describeModbusFrame(request).detail, describeModbusFrame(response).detail]).toEqual([
      "start 19, count 19",
      "19: 10110011 11010110 101",
    ]);
  });

  it("should parse 02 Read discrete inputs", () => {
    // #when
    const [, response] = decodeAdus(
      modbusAdu(1, [0x02, 0x00, 0xc4, 0x00, 0x16]),
      modbusAdu(1, [0x02, 0x03, 0xac, 0xdb, 0x35]),
    );

    // #then
    expect(describeModbusFrame(response).detail).toBe("196: 00110101 11011011 101011");
  });

  it("should parse 03 Read holding registers big-endian", () => {
    // #when
    const [request, response] = decodeAdus(
      modbusAdu(1, [0x03, 0x00, 0x6b, 0x00, 0x03]),
      modbusAdu(1, [0x03, 0x06, 0x02, 0x2b, 0x00, 0x00, 0x00, 0x64]),
    );

    // #then
    expect([request.pdu, response.pdu]).toEqual([
      { kind: "read", start: 107, quantity: 3 },
      { kind: "registers", start: 107, values: [555, 0, 100] },
    ]);
  });

  it("should parse 04 Read input registers", () => {
    // #when
    const [, response] = decodeAdus(
      modbusAdu(1, [0x04, 0x00, 0x08, 0x00, 0x01]),
      modbusAdu(1, [0x04, 0x02, 0x00, 0x0a]),
    );

    // #then
    expect(response.pdu).toEqual({ kind: "registers", start: 8, values: [10] });
  });

  it("should parse 05 Write single coil and its echo", () => {
    // #when
    const decoded = decodeAdus(
      modbusAdu(1, [0x05, 0x00, 0xac, 0xff, 0x00]),
      modbusAdu(1, [0x05, 0x00, 0xac, 0xff, 0x00]),
    );

    // #then
    expect(decoded.map((frame) => [frame.role, describeModbusFrame(frame).detail])).toEqual([
      ["request", "172 = ON"],
      ["response", "172 = ON"],
    ]);
  });

  it("should show a coil value other than 0xFF00 or 0x0000 as is", () => {
    // #when
    const [frame] = decodeAdus(modbusAdu(1, [0x05, 0x00, 0xac, 0x12, 0x34]));

    // #then
    expect(describeModbusFrame(frame).detail).toBe("172 = 0x1234");
  });

  it("should parse 06 Write single register and its echo", () => {
    // #when
    const decoded = decodeAdus(
      modbusAdu(1, [0x06, 0x00, 0x01, 0x00, 0x03]),
      modbusAdu(1, [0x06, 0x00, 0x01, 0x00, 0x03]),
    );

    // #then
    expect(decoded.map((frame) => [frame.role, frame.pdu])).toEqual([
      ["request", { kind: "write-single", address: 1, value: 3 }],
      ["response", { kind: "write-single", address: 1, value: 3 }],
    ]);
  });

  it("should parse 15 Write multiple coils", () => {
    // #when
    const [request, response] = decodeAdus(
      modbusAdu(1, [0x0f, 0x00, 0x13, 0x00, 0x0a, 0x02, 0xcd, 0x01]),
      modbusAdu(1, [0x0f, 0x00, 0x13, 0x00, 0x0a]),
    );

    // #then
    expect([describeModbusFrame(request).detail, response.pdu]).toEqual([
      "19: 10110011 10",
      { kind: "written", start: 19, quantity: 10 },
    ]);
  });

  it("should parse 16 Write multiple registers", () => {
    // #when
    const [request, response] = decodeAdus(
      modbusAdu(1, [0x10, 0x00, 0x01, 0x00, 0x02, 0x04, 0x00, 0x0a, 0x01, 0x02]),
      modbusAdu(1, [0x10, 0x00, 0x01, 0x00, 0x02]),
    );

    // #then
    expect([request.pdu, response.pdu]).toEqual([
      { kind: "write-registers", start: 1, quantity: 2, values: [10, 258] },
      { kind: "written", start: 1, quantity: 2 },
    ]);
  });

  it("should flag a known function whose body fits neither layout", () => {
    // #when
    const [frame] = decodeAdus(modbusAdu(1, [0x03, 0x00, 0x6b]));

    // #then
    expect({ errors: frame.errors, role: frame.role }).toEqual({
      errors: ["length"],
      role: undefined,
    });
  });

  it("should keep an unknown function code as raw bytes", () => {
    // #when
    const [frame] = decodeAdus(modbusAdu(1, [0x2b, 0x0e, 0x01, 0x00]));

    // #then
    expect(describeModbusFrame(frame)).toEqual({
      address: "addr 1",
      role: "request",
      function: "Function 0x2B",
      detail: "0E 01 00",
      status: "CRC ok",
    });
  });
});

describe("decodeModbus exceptions", () => {
  it("should read a function code with the high bit set as an exception response", () => {
    // #given the example in [app 7]
    const [request, response] = decodeAdus(
      modbusAdu(0x0a, [0x01, 0x04, 0xa1, 0x00, 0x01]),
      modbusAdu(0x0a, [0x81, 0x02]),
    );

    // #then
    expect([request.role, describeModbusFrame(response)]).toEqual([
      "request",
      {
        address: "addr 10",
        role: "response",
        function: "Read coils",
        detail: "02 Illegal data address",
        status: "CRC ok",
      },
    ]);
  });

  it.each([
    [0x01, "Illegal function"],
    [0x02, "Illegal data address"],
    [0x03, "Illegal data value"],
    [0x04, "Server device failure"],
    [0x05, "Acknowledge"],
    [0x06, "Server device busy"],
    [0x08, "Memory parity error"],
    [0x0a, "Gateway path unavailable"],
    [0x0b, "Gateway target device failed to respond"],
    [0x07, "Unknown exception"],
  ])("should name exception code 0x%s", (code, name) => {
    // #when / #then
    expect(modbusExceptionName(code)).toBe(name);
  });
});

describe("decodeModbus pairing", () => {
  it("should read a frame that fits both layouts as a request with nothing pending", () => {
    // #given 01 03 xx xx xx is both a Read coils request and a 3-byte response
    const ambiguous = modbusAdu(1, [0x01, 0x03, 0xcd, 0x6b, 0x05]);

    // #when
    const [frame] = decodeAdus(ambiguous);

    // #then
    expect(frame.role).toBe("request");
  });

  it("should read the same frame as a response when it answers a pending request", () => {
    // #given
    const request = modbusAdu(1, [0x01, 0x00, 0x13, 0x00, 0x13]);
    const ambiguous = modbusAdu(1, [0x01, 0x03, 0xcd, 0x6b, 0x05]);

    // #when
    const [, frame] = decodeAdus(request, ambiguous);

    // #then
    expect(frame.role).toBe("response");
  });

  it("should not pair a response with a request to another address", () => {
    // #given
    const request = modbusAdu(2, [0x01, 0x00, 0x13, 0x00, 0x13]);
    const ambiguous = modbusAdu(1, [0x01, 0x03, 0xcd, 0x6b, 0x05]);

    // #when
    const [, frame] = decodeAdus(request, ambiguous);

    // #then
    expect(frame.role).toBe("request");
  });

  it("should recognise a response without its request when only the response layout fits", () => {
    // #when
    const [frame] = decodeAdus(modbusAdu(1, [0x03, 0x02, 0x01, 0x2c]));

    // #then
    expect(frame.pdu).toEqual({ kind: "registers", values: [300] });
  });

  it("should treat a broadcast as a request that expects no answer", () => {
    // #when
    const decoded = decodeAdus(
      modbusAdu(0, [0x06, 0x00, 0x01, 0x00, 0x03]),
      modbusAdu(0, [0x06, 0x00, 0x01, 0x00, 0x03]),
    );

    // #then
    expect(decoded.map((frame) => frame.role)).toEqual(["request", "request"]);
  });
});

describe("encodeModbus", () => {
  it.each<[string, ModbusOptions]>([
    ["19200 8E1", { baudRate: 19_200 }],
    ["9600 8N2", { baudRate: 9600, parity: "none" }],
    ["115200 8O1", { baudRate: 115_200, parity: "odd" }],
  ])("should round-trip through the UART decoder at %s", (_label, options) => {
    // #given
    const messages = [
      { address: 1, pdu: [0x03, 0x00, 0x00, 0x00, 0x02] },
      { address: 1, pdu: [0x03, 0x04, 0x00, 0xe1, 0x01, 0xf4] },
    ];
    const sampleRate = 1_000_000;
    const parity = options.parity ?? "even";
    const stopBits = parity === "none" ? 2 : 1;

    // #when
    const trace = encodeModbus(messages, { ...options, sampleRate });
    const uart = decodeUart(trace, { baudRate: options.baudRate, parity, stopBits });
    const decoded = decodeModbus(uart, { ...options, sampleRate });

    // #then
    expect(summarizeModbus(decoded)).toBe(
      [
        "addr 1  request  Read holding registers  start 0, count 2  CRC ok",
        "addr 1  response  Read holding registers  0: 225 500  CRC ok",
      ].join("\n"),
    );
  });

  it("should send a CRC override so a corrupted frame can be simulated", () => {
    // #given
    const trace = encodeModbus([{ address: 1, pdu: [0x06, 0x00, 0x01, 0x00, 0x03], crc: 0 }], {
      baudRate: 19_200,
      sampleRate: 1_000_000,
    });

    // #when
    const decoded = decodeModbus(decodeUart(trace, { baudRate: 19_200, parity: "even" }), {
      baudRate: 19_200,
      sampleRate: 1_000_000,
    });

    // #then
    expect(describeModbusFrame(decoded[0]).status).toBe("CRC bad");
  });
});
