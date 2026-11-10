import { describe, expect, it } from "vitest";

import { encodeI2c } from "./decoders/i2c";
import { encodeSpi } from "./decoders/spi";
import { encodeUart } from "./decoders/uart";
import { decodeLanes, type LogicSamples } from "./logic-decode";

const SAMPLE_RATE = 1_000_000;

function lane(id: string, data: ArrayLike<number>): LogicSamples {
  return { id, data, sampleRate: SAMPLE_RATE };
}

function text(bytes: string): number[] {
  return Array.from(bytes, (char) => char.charCodeAt(0));
}

describe("decodeLanes", () => {
  it("should list one I2C transaction per start with marks over SDA", () => {
    // #given
    const trace = encodeI2c(
      [
        { address: 0x76, read: false, data: [0xd0] },
        { address: 0x76, read: true, data: [0x60], repeatedStart: true },
      ],
      { sampleRate: SAMPLE_RATE },
    );

    // #when
    const decoded = decodeLanes([lane("scl", trace.scl), lane("sda", trace.sda)], {
      protocol: "i2c",
      sda: "sda",
      scl: "scl",
    });

    // #then
    expect({
      lane: decoded?.lane,
      labels: decoded?.marks.map((mark) => mark.label),
      lines: decoded?.transactions.map((transaction) => transaction.text),
    }).toEqual({
      lane: "sda",
      labels: ["S", "0x76 W", "0xD0", "S", "0x76 R", "0x60 ✕", "P"],
      lines: ["W 0x76: D0", "R 0x76: 60"],
    });
  });

  it("should list one SPI transaction per chip select with marks over MOSI", () => {
    // #given
    const trace = encodeSpi([{ mosi: [0x9f, 0x00], miso: [0x00, 0xef] }, { mosi: [0x06] }], {
      sampleRate: SAMPLE_RATE,
      clockHz: 100_000,
    });

    // #when
    const decoded = decodeLanes(
      [
        lane("cs", trace.cs),
        lane("sclk", trace.sclk),
        lane("mosi", trace.mosi),
        lane("miso", trace.miso),
      ],
      { protocol: "spi", sclk: "sclk", mosi: "mosi", miso: "miso", cs: "cs" },
    );

    // #then
    expect({
      lane: decoded?.lane,
      labels: decoded?.marks.map((mark) => mark.label),
      lines: decoded?.transactions.map((transaction) => transaction.text),
    }).toEqual({
      lane: "mosi",
      labels: ["", "0x9F", "0x00 / 0xEF", "", "", "0x06", ""],
      lines: ["MOSI 9F 00  MISO 00 EF", "MOSI 06  MISO 00"],
    });
  });

  it("should fall back to the MOSI byte when both SPI bytes do not fit", () => {
    // #given
    const trace = encodeSpi([{ mosi: [0x00], miso: [0xef] }], { sampleRate: SAMPLE_RATE });

    // #when
    const decoded = decodeLanes(
      [lane("sclk", trace.sclk), lane("mosi", trace.mosi), lane("miso", trace.miso)],
      { protocol: "spi", sclk: "sclk", mosi: "mosi", miso: "miso" },
    );

    // #then
    expect(decoded?.marks.map((mark) => [mark.label, mark.short])).toEqual([
      ["0x00 / 0xEF", "0x00"],
    ]);
  });

  it("should split UART bytes into lines at each line feed", () => {
    // #given
    const trace = encodeUart(text("ok\r\nhi"), { sampleRate: SAMPLE_RATE, baudRate: 115_200 });

    // #when
    const decoded = decodeLanes([lane("rx", trace.data)], {
      protocol: "uart",
      rx: "rx",
      baudRate: 115_200,
    });

    // #then
    expect(decoded?.transactions.map((transaction) => transaction.text)).toEqual(["ok", "hi"]);
  });

  it("should split UART bytes into lines when the line sits idle", () => {
    // #given
    const first = encodeUart(text("ab"), { sampleRate: SAMPLE_RATE, baudRate: 115_200 });
    const second = encodeUart(text("cd"), {
      sampleRate: SAMPLE_RATE,
      baudRate: 115_200,
      leadBits: 40,
    });
    const data = Uint8Array.from([...first.data, ...second.data]);

    // #when
    const decoded = decodeLanes([lane("rx", data)], {
      protocol: "uart",
      rx: "rx",
      baudRate: 115_200,
    });

    // #then
    expect(decoded?.transactions.map((transaction) => transaction.text)).toEqual(["ab", "cd"]);
  });

  it("should mark a UART framing error in the error tone", () => {
    // #given
    const trace = encodeUart([0x41], { sampleRate: SAMPLE_RATE, baudRate: 9600 });

    // #when
    const decoded = decodeLanes([lane("rx", trace.data)], {
      protocol: "uart",
      rx: "rx",
      baudRate: 9600,
      stopBits: 2,
      parity: "even",
    });

    // #then
    expect(decoded?.marks.map((mark) => mark.tone)).toEqual(["error"]);
  });

  it("should return null when a named lane is missing", () => {
    // #given
    const lanes = [lane("scl", new Uint8Array(16))];

    // #when
    const decoded = decodeLanes(lanes, { protocol: "i2c", sda: "sda", scl: "scl" });

    // #then
    expect(decoded).toBeNull();
  });
});
