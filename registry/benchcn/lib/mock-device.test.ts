import { describe, expect, it } from "vitest";

import { createMockDevice, createRandom, type MockDeviceOptions } from "./mock-device";
import { isAck, isHello, isSample, setCommand, type WireMessage } from "./wire";

function fakeClock(start = 1_700_000_000_000) {
  let t = start;
  const queue: { at: number; fn: () => void; id: number }[] = [];
  let id = 0;
  return {
    now: () => t,
    setTimeout: (fn: () => void, ms: number) => {
      const handle = { at: t + ms, fn, id: id++ };
      queue.push(handle);
      return handle.id;
    },
    clearTimeout: (h: unknown) => {
      const i = queue.findIndex((q) => q.id === h);
      if (i >= 0) queue.splice(i, 1);
    },
    advance(ms: number) {
      const until = t + ms;
      for (;;) {
        queue.sort((a, b) => a.at - b.at);
        const next = queue[0];
        if (!next || next.at > until) break;
        queue.shift();
        t = next.at;
        next.fn();
      }
      t = until;
    },
  };
}

function device(options: MockDeviceOptions = {}) {
  const clock = fakeClock();
  const messages: WireMessage[] = [];
  const dev = createMockDevice({ seed: 7, ...clock, ...options });
  dev.subscribe((m) => messages.push(m));
  return { dev, clock, messages };
}

describe("createRandom", () => {
  it("should be deterministic per seed", () => {
    // #given
    const a = createRandom(3);
    const b = createRandom(3);

    // #then
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("should differ between seeds", () => {
    // #then
    expect(createRandom(4)()).not.toBe(createRandom(3)());
  });
});

describe("createMockDevice", () => {
  describe("start", () => {
    it("should announce itself with a hello", () => {
      // #given
      const { dev, messages } = device();

      // #when
      dev.start();

      // #then
      expect(messages.some(isHello)).toBe(true);
    });

    it("should emit one sample per sensor every interval", () => {
      // #given
      const { dev, clock, messages } = device({ sampleInterval: 1000 });
      dev.start();
      const perTick = messages.filter(isSample).length;

      // #when
      clock.advance(3000);

      // #then
      expect(messages.filter(isSample).length).toBe(perTick * 4);
    });

    it("should expose the latest reading per channel", () => {
      // #given
      const { dev } = device();

      // #when
      dev.start();

      // #then
      expect(dev.readings().temp).toMatchObject({ ch: "temp", u: "°C" });
    });
  });

  describe("stop", () => {
    it("should stop sampling", () => {
      // #given
      const { dev, clock, messages } = device();
      dev.start();
      dev.stop();
      const before = messages.length;

      // #when
      clock.advance(5000);

      // #then
      expect(messages.length).toBe(before);
    });
  });

  describe("send set", () => {
    it("should mark the actuator commanded and pending immediately", () => {
      // #given
      const { dev } = device({ faultRate: 0 });
      dev.start();

      // #when
      dev.send(setCommand("pump", true));

      // #then
      expect(dev.actuator("pump")).toMatchObject({
        commanded: true,
        confirmed: false,
        pending: true,
      });
    });

    it("should not acknowledge before the latency has elapsed", () => {
      // #given
      const { dev, clock, messages } = device({ faultRate: 0, ackLatency: [200, 200] });
      dev.start();
      dev.send(setCommand("pump", true));

      // #when
      clock.advance(199);

      // #then
      expect(messages.filter(isAck)).toHaveLength(0);
    });

    it("should acknowledge with the matching nonce after the latency", () => {
      // #given
      const { dev, clock, messages } = device({ faultRate: 0, ackLatency: [200, 200] });
      dev.start();
      const command = setCommand("pump", true);
      dev.send(command);

      // #when
      clock.advance(200);

      // #then
      expect(messages.filter(isAck)[0]).toMatchObject({
        ack: command.n,
        ok: true,
        id: "pump",
        v: true,
      });
    });

    it("should confirm the actuator once acknowledged", () => {
      // #given
      const { dev, clock } = device({ faultRate: 0, ackLatency: [200, 200] });
      dev.start();
      dev.send(setCommand("pump", true));

      // #when
      clock.advance(200);

      // #then
      expect(dev.actuator("pump")).toMatchObject({ confirmed: true, pending: false });
    });

    it("should raise soil moisture while the pump is on", () => {
      // #given
      const { dev, clock } = device({ faultRate: 0, ackLatency: [0, 0] });
      dev.start();
      const dry = dev.readings().soil.v as number;

      // #when the pump runs for 20 s
      dev.send(setCommand("pump", true));
      clock.advance(20_000);

      // #then
      expect(dev.readings().soil.v as number).toBeGreaterThan(dry + 10);
    });

    it("should drop commands at the fault rate without acknowledging", () => {
      // #given
      const { dev, clock, messages } = device({ faultRate: 1, ackLatency: [10, 10] });
      dev.start();

      // #when
      dev.send(setCommand("led", true));
      clock.advance(1000);

      // #then
      expect(messages.filter(isAck)).toHaveLength(0);
    });

    it("should leave a dropped command unconfirmed and not pending", () => {
      // #given
      const { dev, clock } = device({ faultRate: 1, ackLatency: [10, 10] });
      dev.start();

      // #when
      dev.send(setCommand("led", true));
      clock.advance(1000);

      // #then
      expect(dev.actuator("led")).toMatchObject({
        commanded: true,
        confirmed: false,
        pending: false,
      });
    });

    it("should reject unknown actuators", () => {
      // #given
      const { dev, clock, messages } = device({ faultRate: 0, ackLatency: [5, 5] });
      dev.start();

      // #when
      dev.send(setCommand("nope", 1));
      clock.advance(10);

      // #then
      expect(messages.filter(isAck)).toContainEqual(
        expect.objectContaining({ ok: false, err: "unknown id" }),
      );
    });
  });

  describe("send ping", () => {
    it("should answer with an ok ack", () => {
      // #given
      const { dev, clock, messages } = device({ ackLatency: [5, 5] });
      dev.start();

      // #when
      dev.send({ cmd: "ping", n: 999 });
      clock.advance(10);

      // #then
      expect(messages.filter(isAck)).toContainEqual(
        expect.objectContaining({ ack: 999, ok: true }),
      );
    });
  });

  describe("waveform", () => {
    it("should be deterministic for the same window", () => {
      // #given
      const { dev } = device();

      // #when
      const a = dev.waveform("ch1", 0, 1000, 100_000);
      const b = dev.waveform("ch1", 0, 1000, 100_000);

      // #then
      expect(Array.from(a)).toEqual(Array.from(b));
    });

    it("should span the configured amplitude", () => {
      // #given
      const { dev } = device();

      // #when
      const samples = dev.waveform("ch1", 0, 1000, 100_000);

      // #then
      expect([Math.min(...samples), Math.max(...samples)].map((v) => Math.round(v))).toEqual([
        -1, 1,
      ]);
    });

    it("should return zeros for an unknown channel", () => {
      // #given
      const { dev } = device();

      // #then
      expect(dev.waveform("missing", 0, 4, 10)).toEqual(new Float32Array(4));
    });
  });
});

describe("createMockDevice heater setpoint", () => {
  it("should clamp a setpoint outside the channel range and acknowledge the applied value", () => {
    // #given the heater accepts 15 to 35 °C
    const { dev, clock, messages } = device({ faultRate: 0, ackLatency: [100, 100] });
    dev.start();

    // #when
    dev.send(setCommand("heater", 50));
    clock.advance(100);

    // #then
    expect(messages.filter(isAck)[0]).toMatchObject({ ok: true, id: "heater", v: 35 });
  });

  it("should move the chamber temperature towards the setpoint", () => {
    // #given the chamber starts at 20 °C
    const { dev, clock } = device({ faultRate: 0, ackLatency: [0, 0] });
    dev.start();

    // #when the setpoint goes to 30 °C for 20 seconds
    dev.send(setCommand("heater", 30));
    clock.advance(20_000);

    // #then it has closed most of the gap without overshooting
    const chamber = dev.readings().chamber.v as number;
    expect(chamber > 27 && chamber < 30.2).toBe(true);
  });
});
