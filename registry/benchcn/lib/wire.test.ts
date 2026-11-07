import { describe, expect, it } from "vitest";

import {
  createClockMapper,
  createLineParser,
  encodeMessage,
  isAck,
  isBlock,
  isLog,
  isSample,
  parseLine,
  setCommand,
  type WireMessage,
} from "./wire";

describe("parseLine", () => {
  it("should parse a sample", () => {
    // #when
    const message = parseLine('{"ch":"soil","v":42,"u":"%","t":1731000000}');

    // #then
    expect(message && isSample(message) ? message : null).toEqual({
      ch: "soil",
      v: 42,
      u: "%",
      t: 1731000000,
    });
  });

  it("should parse a block", () => {
    // #when
    const message = parseLine('{"ch":"ch1","vs":[0,1,0],"sr":1000}');

    // #then
    expect(message && isBlock(message)).toBe(true);
  });

  it("should parse an ack", () => {
    // #when
    const message = parseLine('{"ack":7,"ok":false,"err":"timeout"}');

    // #then
    expect(message && isAck(message)).toBe(true);
  });

  it("should turn plain text into an info log and strip the carriage return", () => {
    // #when
    const message = parseLine("boot ok\r");

    // #then
    expect(message).toEqual({ log: "boot ok", lvl: "info" });
  });

  it("should turn malformed JSON into a log", () => {
    // #when
    const message = parseLine('{"ch":"x"');

    // #then
    expect(message && isLog(message)).toBe(true);
  });

  it("should turn JSON of an unknown shape into a log", () => {
    // #when
    const message = parseLine('{"foo":1}');

    // #then
    expect(message && isLog(message)).toBe(true);
  });

  it("should reject a block with non-numeric values", () => {
    // #when
    const message = parseLine('{"ch":"x","vs":["a"],"sr":10}');

    // #then
    expect(message && isLog(message)).toBe(true);
  });

  it("should ignore blank lines", () => {
    // #when / #then
    expect(parseLine("   ")).toBeNull();
  });
});

describe("createLineParser", () => {
  it("should reassemble lines across chunk boundaries", () => {
    // #given
    const seen: WireMessage[] = [];
    const parser = createLineParser((m) => seen.push(m));

    // #when a sample is split over two chunks and followed by a log
    parser.push('{"ch":"t","v":2');
    parser.push('1.5}\n{"log":"hi"}\nleft');

    // #then both complete lines are emitted
    expect(seen).toEqual([{ ch: "t", v: 21.5 }, { log: "hi" }]);
  });

  it("should flush a trailing partial line on end", () => {
    // #given
    const seen: WireMessage[] = [];
    const parser = createLineParser((m) => seen.push(m));
    parser.push("left");

    // #when
    parser.end();

    // #then
    expect(seen).toEqual([{ log: "left", lvl: "info" }]);
  });

  it("should accept bytes", () => {
    // #given
    const seen: WireMessage[] = [];
    const parser = createLineParser((m) => seen.push(m));

    // #when
    parser.push(new TextEncoder().encode('{"ch":"a","v":true}\n'));

    // #then
    expect(seen).toEqual([{ ch: "a", v: true }]);
  });
});

describe("encodeMessage", () => {
  it("should round-trip a command through a newline-terminated line", () => {
    // #given
    const command = setCommand("relay1", true);

    // #when
    const line = encodeMessage(command);

    // #then
    expect({ terminated: line.endsWith("\n"), parsed: parseLine(line) }).toEqual({
      terminated: true,
      parsed: command,
    });
  });
});

describe("setCommand", () => {
  it("should issue increasing nonces", () => {
    // #when
    const first = setCommand("a", 1).n;
    const second = setCommand("a", 1).n;

    // #then
    expect(second).toBeGreaterThan(first);
  });
});

describe("createClockMapper", () => {
  it("should pass epoch seconds through as milliseconds", () => {
    // #given
    const map = createClockMapper(() => 5000);

    // #then
    expect(map(1731000000)).toBe(1731000000000);
  });

  it("should anchor boot-relative seconds to the receiver clock", () => {
    // #given a receiver clock at 10 s and a device reporting 12.5 s since boot
    const map = createClockMapper(() => 10_000);
    map(12.5);

    // #when the device reports one second later
    const mapped = map(13.5);

    // #then
    expect(mapped).toBe(11_000);
  });

  it("should use now when the timestamp is missing", () => {
    // #then
    expect(createClockMapper(() => 42)(undefined)).toBe(42);
  });
});
