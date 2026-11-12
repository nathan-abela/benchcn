import { describe, expect, it } from "vitest";

import { createMsgpackWriter, decodeMsgpackAll } from "./msgpack";
import {
  createNt4Clock,
  createNt4Session,
  decodeNt4Binary,
  encodeNt4Value,
  type Nt4Channels,
  nt4Url,
  parseNt4Text,
} from "./nt4";
import type { WireMessage } from "./wire";

// The 17-byte double value update from the spec, section "Binary Data Frames".
const SPEC_DOUBLE_UPDATE = Uint8Array.from([
  0x94, 0x32, 0xd2, 0x07, 0x27, 0x0e, 0x00, 0x01, 0xcb, 0x3f, 0xbf, 0x97, 0x24, 0x74, 0x53, 0x8e,
  0xf3,
]);

const CHANNELS: Nt4Channels = {
  drive: {
    kind: "actuator",
    topic: "/robot/drive/enabled",
    command: { topic: "/dashboard/drive", type: "boolean" },
  },
  shooter: {
    kind: "setpoint",
    unit: "rpm",
    command: { topic: "/dashboard/shooter", type: "double" },
  },
  "pose-x": { topic: "/robot/pose", index: 0, unit: "m" },
  "pose-y": { topic: "/robot/pose", index: 1, unit: "m" },
};

const timeReply = (serverTime: number, echoed: number) =>
  createMsgpackWriter().arrayHeader(4).int(-1).int(serverTime).int(2).int(echoed).bytes();

function session(channels = CHANNELS) {
  let clock = 1_000;
  const texts: unknown[] = [];
  const binaries: unknown[][] = [];
  const emitted: WireMessage[] = [];
  const s = createNt4Session(
    channels,
    { now: () => clock },
    {
      sendText: (text) => texts.push(JSON.parse(text)),
      sendBinary: (bytes) => binaries.push(decodeMsgpackAll(bytes)[0] as unknown[]),
      emit: (m) => emitted.push(m),
    },
  );
  const advance = (ms: number) => {
    clock += ms;
  };
  // Opens the session and answers its first time request after a 10 ms round trip, with the
  // server clock at 5 s.
  const sync = () => {
    s.open();
    const sentAt = binaries[0][3] as number;
    advance(10);
    s.binary(timeReply(5_000_000, sentAt));
  };
  return { s, texts, binaries, emitted, advance, sync };
}

describe("nt4Url", () => {
  it("should use the /nt/<name> resource on the standard unsecure port", () => {
    // #given

    // #when
    const url = nt4Url("10.12.34.2", "dash");

    // #then
    expect(url).toBe("ws://10.12.34.2:5810/nt/dash");
  });
});

describe("parseNt4Text", () => {
  it("should keep announce messages and drop what the spec says to ignore", () => {
    // #given a frame with one valid message and one of each invalid kind
    const text = JSON.stringify([
      {
        method: "announce",
        params: { name: "/robot/pose", id: 3, type: "double[]", properties: {} },
      },
      "not an object",
      { params: {} },
      { method: 1, params: {} },
      { method: "announce", params: [] },
      { method: "shout", params: {} },
    ]);

    // #when
    const messages = parseNt4Text(text);

    // #then
    expect(messages).toEqual([
      {
        method: "announce",
        params: { name: "/robot/pose", id: 3, type: "double[]", properties: {} },
      },
    ]);
  });
});

describe("binary frames", () => {
  it("should decode the spec's double value update", () => {
    // #given the bytes from the spec

    // #when
    const values = decodeNt4Binary(SPEC_DOUBLE_UPDATE);

    // #then
    expect(values).toEqual([{ id: 50, timestamp: 120_000_000, type: 1, value: 0.1234 }]);
  });

  it("should encode a double update the spec's way", () => {
    // #given

    // #when
    const bytes = encodeNt4Value(50, 120_000_000, "double", 0.1234);

    // #then
    expect(decodeNt4Binary(bytes)).toEqual(decodeNt4Binary(SPEC_DOUBLE_UPDATE));
  });

  it("should refuse a value that does not match the type", () => {
    // #given

    // #when
    const encode = () => encodeNt4Value(1, 0, "boolean", 1);

    // #then
    expect(encode).toThrow(TypeError);
  });
});

describe("createNt4Clock", () => {
  it("should map local time to server time with half the shortest round trip", () => {
    // #given a 100 us round trip, then a slower 400 us one
    const clock = createNt4Clock();
    clock.reply(5_000, 1_000, 1_100);
    clock.reply(9_000, 2_000, 2_400);

    // #when
    const server = clock.serverTime(1_100);

    // #then the slower measurement is ignored
    expect(server).toBe(5_050);
  });
});

describe("createNt4Session", () => {
  it("should measure the clock before sending any control message", () => {
    // #given
    const { s, texts, binaries } = session();

    // #when
    s.open();

    // #then one time request: topic -1, timestamp 0, an int carrying local microseconds
    expect({ texts, request: binaries[0].slice(0, 3), local: binaries[0][3] }).toEqual({
      texts: [],
      request: [-1, 0, 2],
      local: 1_000_000,
    });
  });

  it("should publish and subscribe once the clock is synchronised", () => {
    // #given
    const { texts, sync } = session();

    // #when
    sync();

    // #then
    expect(texts).toEqual([
      [
        {
          method: "publish",
          params: { name: "/dashboard/drive", pubuid: 1, type: "boolean", properties: {} },
        },
        {
          method: "publish",
          params: { name: "/dashboard/shooter", pubuid: 2, type: "double", properties: {} },
        },
        {
          method: "subscribe",
          params: { topics: ["/robot/drive/enabled", "/robot/pose"], subuid: 1, options: {} },
        },
      ],
    ]);
  });

  it("should read array elements from an announced topic, stamped in local time", () => {
    // #given the pose topic announced as id 3
    const { s, emitted, sync } = session();
    sync();
    s.text(
      JSON.stringify([
        {
          method: "announce",
          params: { name: "/robot/pose", id: 3, type: "double[]", properties: {} },
        },
      ]),
    );
    emitted.length = 0;

    // #when a value arrives at server time 5.5 s
    s.binary(
      createMsgpackWriter()
        .arrayHeader(4)
        .int(3)
        .int(5_500_000)
        .int(17)
        .arrayHeader(3)
        .float64(1.25)
        .float64(-2)
        .float64(90)
        .bytes(),
    );

    // #then server 5 s was local 1.010 s (round trip 10 ms), so 5.5 s is local 1.505 s
    expect(emitted).toEqual([
      { ch: "pose-x", v: 1.25, u: "m", t: 1.505 },
      { ch: "pose-y", v: -2, u: "m", t: 1.505 },
    ]);
  });

  it("should ignore values for topic ids it was never told about", () => {
    // #given
    const { s, emitted, sync } = session();
    sync();
    emitted.length = 0;

    // #when
    s.binary(SPEC_DOUBLE_UPDATE);

    // #then
    expect(emitted).toEqual([]);
  });

  it("should not send values before the clock is synchronised", () => {
    // #given an open session with no time reply yet
    const { s, binaries, emitted } = session();
    s.open();

    // #when
    s.send({ cmd: "set", n: 1, id: "drive", v: true });

    // #then only the time request went out
    expect({ binaries: binaries.length, log: emitted.at(-1) }).toEqual({
      binaries: 1,
      log: { log: 'nt4: "drive" not sent, clock not synchronised yet', lvl: "warn" },
    });
  });

  it("should send a command with its publisher id in server time and confirm it from the state topic", () => {
    // #given a synchronised session with the state topic announced
    const { s, binaries, emitted, sync } = session();
    sync();
    s.text(
      JSON.stringify([
        {
          method: "announce",
          params: { name: "/robot/drive/enabled", id: 4, type: "boolean", properties: {} },
        },
      ]),
    );
    emitted.length = 0;

    // #when the drive is commanded and the robot reports it
    s.send({ cmd: "set", n: 9, id: "drive", v: true });
    s.binary(createMsgpackWriter().arrayHeader(4).int(4).int(5_000_100).int(0).bool(true).bytes());

    // #then
    expect({ sent: binaries.at(-1), emitted: emitted.slice(0, 1) }).toEqual({
      sent: [1, 5_005_000, 0, true],
      emitted: [{ ack: 9, ok: true, id: "drive", v: true }],
    });
  });

  it("should publish with the announced type and refuse values that do not fit it", () => {
    // #given the server announces the shooter topic as int, not the double asked for
    const { s, binaries, emitted, sync } = session();
    sync();
    s.text(
      JSON.stringify([
        {
          method: "announce",
          params: { name: "/dashboard/shooter", id: 7, type: "int", pubuid: 2, properties: {} },
        },
      ]),
    );
    const before = binaries.length;

    // #when
    s.send({ cmd: "set", n: 2, id: "shooter", v: 1500.5 });
    s.send({ cmd: "set", n: 3, id: "shooter", v: 1500 });

    // #then
    expect({ sent: binaries.slice(before), log: emitted.at(-1) }).toEqual({
      sent: [[2, 5_005_000, 2, 1500]],
      log: { log: 'nt4: "shooter" is int, cannot send 1500.5', lvl: "warn" },
    });
  });

  it("should report a dead link after three seconds without a time reply", () => {
    // #given
    const { s, advance, sync } = session();
    sync();

    // #when
    advance(2_000);
    const alive = s.tick();
    advance(1_500);
    const dead = s.tick();

    // #then
    expect({ alive, dead }).toEqual({ alive: true, dead: false });
  });

  it("should unpublish and unsubscribe on close", () => {
    // #given
    const { s, texts, sync } = session();
    sync();

    // #when
    s.close();

    // #then
    expect(texts.at(-1)).toEqual([
      { method: "unpublish", params: { pubuid: 1 } },
      { method: "unpublish", params: { pubuid: 2 } },
      { method: "unsubscribe", params: { subuid: 1 } },
    ]);
  });
});
