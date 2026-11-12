import { describe, expect, it } from "vitest";

import {
  advertiseOp,
  createRosbridgeSession,
  parseRosbridge,
  quaternionToHeading,
  type RosbridgeChannels,
  readField,
  subscribeOp,
  writeField,
} from "./rosbridge";
import type { WireMessage } from "./wire";

const CHANNELS: RosbridgeChannels = {
  drive: {
    kind: "actuator",
    topic: "/drive/enabled",
    type: "std_msgs/msg/Bool",
    command: { topic: "/drive/enable", type: "std_msgs/msg/Bool" },
  },
  linear: {
    kind: "setpoint",
    command: { topic: "/cmd_vel", type: "geometry_msgs/msg/Twist", field: "linear.x" },
  },
  angular: {
    kind: "setpoint",
    command: { topic: "/cmd_vel", type: "geometry_msgs/msg/Twist", field: "angular.z" },
  },
  "pose-x": {
    topic: "/odom",
    type: "nav_msgs/msg/Odometry",
    field: "pose.pose.position.x",
    unit: "m",
  },
  "pose-y": { topic: "/odom", field: "pose.pose.position.y", unit: "m" },
};

function session(channels = CHANNELS, throttleRate?: number) {
  const sent: Record<string, unknown>[] = [];
  const emitted: WireMessage[] = [];
  const s = createRosbridgeSession(
    channels,
    { throttleRate },
    { send: (text) => sent.push(JSON.parse(text)), emit: (m) => emitted.push(m) },
  );
  return { s, sent, emitted };
}

describe("parseRosbridge", () => {
  it("should accept the spec's envelope example", () => {
    // #given the example from section 1, "Message envelope"
    const text = '{ "op": "Example", "id": "fred" }';

    // #when
    const op = parseRosbridge(text);

    // #then
    expect(op).toEqual({ op: "Example", id: "fred" });
  });

  it("should ignore anything without a string op", () => {
    // #given
    const texts = ['{"topic":"/a"}', '{"op":3}', "[]", "not json"];

    // #when
    const parsed = texts.map(parseRosbridge);

    // #then
    expect(parsed).toEqual([null, null, null, null]);
  });
});

describe("rosbridge ops", () => {
  it("should build advertise with the fields the spec requires", () => {
    // #given the topic and type from the spec's advertise example

    // #when
    const op = advertiseOp("/foo", "std_msgs/msg/String");

    // #then
    expect(op).toEqual({
      op: "advertise",
      id: "benchcn:/foo",
      topic: "/foo",
      type: "std_msgs/msg/String",
    });
  });

  it("should send throttle_rate as integer milliseconds and omit it when zero", () => {
    // #given

    // #when
    const throttled = subscribeOp("/odom", { throttleRate: 99.6 });
    const unthrottled = subscribeOp("/odom", { throttleRate: 0 });

    // #then
    expect({
      throttled: throttled.throttle_rate,
      unthrottled: "throttle_rate" in unthrottled,
    }).toEqual({ throttled: 100, unthrottled: false });
  });
});

describe("fields", () => {
  it("should read and write dot paths without touching siblings", () => {
    // #given a Twist with an angular rate already set
    const msg = { angular: { z: 0.4 } };

    // #when
    const written = writeField(msg, "linear.x", 0.2);

    // #then
    expect({ written, read: readField(written, "linear.x"), original: msg }).toEqual({
      written: { angular: { z: 0.4 }, linear: { x: 0.2 } },
      read: 0.2,
      original: { angular: { z: 0.4 } },
    });
  });

  it("should turn a yaw quaternion into degrees counterclockwise from +x", () => {
    // #given a quarter turn left about z
    const q = { x: 0, y: 0, z: Math.SQRT1_2, w: Math.SQRT1_2 };

    // #when
    const heading = quaternionToHeading(q);

    // #then
    expect(heading).toBeCloseTo(90, 9);
  });
});

describe("createRosbridgeSession", () => {
  it("should announce channels, subscribe once per topic and advertise command topics", () => {
    // #given
    const { s, sent, emitted } = session(CHANNELS, 100);

    // #when
    s.open();

    // #then
    expect({ hello: emitted[0], sent }).toEqual({
      hello: {
        hello: "benchcn/0",
        dev: "rosbridge",
        chs: [
          { id: "drive", kind: "actuator" },
          { id: "linear", kind: "setpoint" },
          { id: "angular", kind: "setpoint" },
          { id: "pose-x", kind: "sensor", u: "m" },
          { id: "pose-y", kind: "sensor", u: "m" },
        ],
      },
      sent: [
        {
          op: "subscribe",
          id: "benchcn:/drive/enabled",
          topic: "/drive/enabled",
          type: "std_msgs/msg/Bool",
          throttle_rate: 100,
        },
        {
          op: "subscribe",
          id: "benchcn:/odom",
          topic: "/odom",
          type: "nav_msgs/msg/Odometry",
          throttle_rate: 100,
        },
        {
          op: "advertise",
          id: "benchcn:/drive/enable",
          topic: "/drive/enable",
          type: "std_msgs/msg/Bool",
        },
        {
          op: "advertise",
          id: "benchcn:/cmd_vel",
          topic: "/cmd_vel",
          type: "geometry_msgs/msg/Twist",
        },
      ],
    });
  });

  it("should turn one published message into a sample per mapped channel", () => {
    // #given
    const { s, emitted } = session();

    // #when the server forwards an odometry message
    s.message(
      JSON.stringify({
        op: "publish",
        topic: "/odom",
        msg: { pose: { pose: { position: { x: 1.5, y: -0.25, z: 0 } } } },
      }),
    );

    // #then
    expect(emitted).toEqual([
      { ch: "pose-x", v: 1.5, u: "m" },
      { ch: "pose-y", v: -0.25, u: "m" },
    ]);
  });

  it("should publish the whole Twist when two channels share it", () => {
    // #given
    const { s, sent } = session();

    // #when the robot block sends linear then angular
    s.send({ cmd: "set", n: 1, id: "linear", v: 0.3 });
    s.send({ cmd: "set", n: 2, id: "angular", v: -0.8 });

    // #then the second publish keeps the first field
    expect(sent).toEqual([
      { op: "publish", topic: "/cmd_vel", msg: { linear: { x: 0.3 } } },
      { op: "publish", topic: "/cmd_vel", msg: { linear: { x: 0.3 }, angular: { z: -0.8 } } },
    ]);
  });

  it("should acknowledge a command only when the state topic reports the commanded value", () => {
    // #given drive commanded on
    const { s, sent, emitted } = session();
    s.send({ cmd: "set", n: 7, id: "drive", v: true });

    // #when the robot first reports the old state, then the new one
    s.message(JSON.stringify({ op: "publish", topic: "/drive/enabled", msg: { data: false } }));
    const afterStale = emitted.length;
    s.message(JSON.stringify({ op: "publish", topic: "/drive/enabled", msg: { data: true } }));

    // #then
    expect({ published: sent[0], afterStale, emitted }).toEqual({
      published: { op: "publish", topic: "/drive/enable", msg: { data: true } },
      afterStale: 1,
      emitted: [
        { ch: "drive", v: false },
        { ack: 7, ok: true, id: "drive", v: true },
        { ch: "drive", v: true },
      ],
    });
  });

  it("should never acknowledge a channel without a state topic", () => {
    // #given
    const { s, emitted } = session();

    // #when a setpoint goes out and unrelated traffic arrives
    s.send({ cmd: "set", n: 3, id: "linear", v: 0.3 });
    s.message(JSON.stringify({ op: "publish", topic: "/cmd_vel", msg: { linear: { x: 0.3 } } }));

    // #then
    expect(emitted).toEqual([]);
  });

  it("should log instead of publishing for a channel with no command topic", () => {
    // #given
    const { s, sent, emitted } = session();

    // #when
    s.send({ cmd: "set", n: 4, id: "pose-x", v: 1 });

    // #then
    expect({ sent, emitted }).toEqual({
      sent: [],
      emitted: [{ log: 'rosbridge: no command topic for "pose-x"', lvl: "warn" }],
    });
  });

  it("should unsubscribe and unadvertise on close", () => {
    // #given
    const { s, sent } = session();

    // #when
    s.close();

    // #then
    expect(sent.map((op) => `${op.op} ${op.topic}`)).toEqual([
      "unsubscribe /drive/enabled",
      "unsubscribe /odom",
      "unadvertise /drive/enable",
      "unadvertise /cmd_vel",
    ]);
  });
});
