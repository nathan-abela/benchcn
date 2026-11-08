import { describe, expect, it } from "vitest";

import { createSourceStore, type Transport } from "./source-store";
import type { WireMessage } from "./wire";

function fakeTransport() {
  const listeners = new Set<(m: WireMessage) => void>();
  const sent: WireMessage[] = [];
  let started = false;
  const transport: Transport = {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    send: (message) => sent.push(message),
    start() {
      started = true;
      return () => {
        started = false;
      };
    },
  };
  const emit = (message: WireMessage) => {
    for (const listener of listeners) listener(message);
  };
  return { transport, sent, emit, isStarted: () => started };
}

describe("createSourceStore", () => {
  it("should keep the latest reading and a bounded history per channel", () => {
    // #given
    const fake = fakeTransport();
    const store = createSourceStore(fake.transport, { historyLength: 3 });
    store.start();

    // #when four samples arrive
    for (const v of [1, 2, 3, 4]) fake.emit({ ch: "temp", v });

    // #then
    const snapshot = store.getSnapshot();
    expect({ latest: snapshot.readings.temp.v, history: snapshot.history.temp }).toEqual({
      latest: 4,
      history: [2, 3, 4],
    });
  });

  it("should track actuators announced in hello and query their state", () => {
    // #given
    const fake = fakeTransport();
    const store = createSourceStore(fake.transport);
    store.start();

    // #when
    fake.emit({ hello: "benchcn/0", chs: [{ id: "pump", kind: "actuator" }] });

    // #then a get went out and the actuator is tracked
    expect({
      queried: fake.sent.filter((m) => "cmd" in m && m.cmd === "get").map((m) => "id" in m && m.id),
      tracked: Object.keys(store.getSnapshot().actuators),
    }).toEqual({ queried: ["pump"], tracked: ["pump"] });
  });

  it("should confirm a queried actuator from the get ack", () => {
    // #given
    const fake = fakeTransport();
    const store = createSourceStore(fake.transport, { actuators: ["pump"] });
    store.start();
    const query = fake.sent.find((m) => "cmd" in m && m.cmd === "get");

    // #when
    fake.emit({ ack: (query as { n: number }).n, ok: true, v: true });

    // #then
    expect(store.getSnapshot().actuators.pump.confirmed).toBe(true);
  });

  it("should send a set command and resolve it from the matching ack", () => {
    // #given
    const fake = fakeTransport();
    const store = createSourceStore(fake.transport, { actuators: ["pump"] });
    store.start();

    // #when
    store.command("pump", true);
    const set = fake.sent.find((m) => "cmd" in m && m.cmd === "set") as { n: number };
    fake.emit({ ack: set.n, ok: true, v: true });

    // #then
    expect(store.getSnapshot().actuators.pump).toMatchObject({
      commanded: true,
      confirmed: true,
      pending: false,
    });
  });

  it("should keep logs bounded and count every message", () => {
    // #given
    const fake = fakeTransport();
    const store = createSourceStore(fake.transport, { logLimit: 2 });
    store.start();

    // #when
    fake.emit({ log: "a" });
    fake.emit({ log: "b" });
    fake.emit({ log: "c" });

    // #then
    const snapshot = store.getSnapshot();
    expect({ logs: snapshot.logs.map((l) => l.log), received: snapshot.received }).toEqual({
      logs: ["b", "c"],
      received: 3,
    });
  });

  it("should hand blocks to block listeners", () => {
    // #given
    const fake = fakeTransport();
    const store = createSourceStore(fake.transport);
    const blocks: number[] = [];
    store.onBlock((block) => blocks.push(block.sr));
    store.start();

    // #when
    fake.emit({ ch: "ch1", vs: [0, 1], sr: 1000 });

    // #then
    expect(blocks).toEqual([1000]);
  });

  it("should keep tracking actuators after a stop and restart", () => {
    // #given a store that was started, stopped and started again, as React strict mode does
    const fake = fakeTransport();
    const store = createSourceStore(fake.transport, { actuators: ["pump"] });
    store.start()();
    store.start();

    // #when
    store.command("pump", true);

    // #then the command is reflected in the snapshot
    expect(store.getSnapshot().actuators.pump).toMatchObject({ commanded: true, pending: true });
  });

  it("should stop the transport when the returned function is called", () => {
    // #given
    const fake = fakeTransport();
    const stop = createSourceStore(fake.transport).start();

    // #when
    stop();

    // #then
    expect(fake.isStarted()).toBe(false);
  });
});
