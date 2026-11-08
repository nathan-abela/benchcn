import { describe, expect, it } from "vitest";

import {
  type AlarmEvent,
  alarmState,
  type AlarmTable,
  reduceAlarms,
  ruleActive,
  sortAlarms,
} from "./alarms";

const activate = (id: string, at: number, priority: "high" | "low" = "high"): AlarmEvent => ({
  type: "activate",
  id,
  message: id,
  priority,
  at,
});

const run = (events: AlarmEvent[], from: AlarmTable = {}): AlarmTable =>
  events.reduce(reduceAlarms, from);

describe("reduceAlarms", () => {
  it("should raise a new alarm as active and unacknowledged", () => {
    // #when
    const table = run([activate("temp", 1000)]);

    // #then
    expect(alarmState(table.temp)).toBe("unacknowledged");
  });

  it("should keep a cleared alarm until someone acknowledges it", () => {
    // #when
    const table = run([activate("temp", 1000), { type: "clear", id: "temp", at: 2000 }]);

    // #then
    expect(alarmState(table.temp)).toBe("cleared-unacknowledged");
  });

  it("should drop a cleared alarm once acknowledged", () => {
    // #when
    const table = run([
      activate("temp", 1000),
      { type: "clear", id: "temp", at: 2000 },
      { type: "acknowledge", id: "temp", at: 3000 },
    ]);

    // #then
    expect(table.temp).toBeUndefined();
  });

  it("should drop an acknowledged alarm as soon as its condition clears", () => {
    // #when
    const table = run([
      activate("temp", 1000),
      { type: "acknowledge", id: "temp", at: 1500 },
      { type: "clear", id: "temp", at: 2000 },
    ]);

    // #then
    expect(table.temp).toBeUndefined();
  });

  it("should need a fresh acknowledgement for every new activation", () => {
    // #given an alarm that was acknowledged and cleared, then raised again
    const table = run([
      activate("temp", 1000),
      { type: "acknowledge", id: "temp", at: 1500 },
      { type: "clear", id: "temp", at: 2000 },
      activate("temp", 3000),
    ]);

    // #then
    expect({ state: alarmState(table.temp), activations: table.temp.activations }).toEqual({
      state: "unacknowledged",
      activations: 1,
    });
  });

  it("should count repeat activations while the record is still listed", () => {
    // #when the alarm chatters without being acknowledged
    const table = run([
      activate("temp", 1000),
      { type: "clear", id: "temp", at: 2000 },
      activate("temp", 3000),
    ]);

    // #then
    expect(table.temp.activations).toBe(2);
  });

  it("should end a one-shot shelve when the condition clears", () => {
    // #given
    const table = run([
      activate("temp", 1000),
      { type: "shelve", id: "temp", at: 1500 },
      { type: "clear", id: "temp", at: 2000 },
    ]);

    // #then it is back in view, still waiting for an acknowledgement
    expect({ shelving: table.temp.shelving, state: alarmState(table.temp) }).toEqual({
      shelving: null,
      state: "cleared-unacknowledged",
    });
  });

  it("should keep a timed shelve through clears until the time runs out", () => {
    // #given shelved for one minute
    const shelved = run([
      activate("temp", 0),
      { type: "shelve", id: "temp", at: 0, minutes: 1 },
      { type: "clear", id: "temp", at: 10_000 },
    ]);

    // #when
    const before = run([{ type: "tick", at: 59_999 }], shelved);
    const after = run([{ type: "tick", at: 60_000 }], shelved);

    // #then
    expect([before.temp.shelving?.kind, after.temp.shelving]).toEqual(["timed", null]);
  });

  it("should unshelve on request", () => {
    // #when
    const table = run([
      activate("temp", 0),
      { type: "shelve", id: "temp", at: 0, minutes: 30 },
      { type: "unshelve", id: "temp", at: 1000 },
    ]);

    // #then
    expect(table.temp.shelving).toBeNull();
  });
});

describe("sortAlarms", () => {
  it("should put unacknowledged first, then active, then priority, then newest", () => {
    // #given
    const table = run([
      activate("old-low", 1000, "low"),
      activate("acked-high", 2000),
      { type: "acknowledge", id: "acked-high", at: 2100 },
      activate("new-high", 3000),
      activate("cleared-high", 500),
      { type: "clear", id: "cleared-high", at: 600 },
    ]);

    // #when
    const order = sortAlarms(Object.values(table)).map((a) => a.id);

    // #then
    expect(order).toEqual(["new-high", "old-low", "cleared-high", "acked-high"]);
  });
});

describe("ruleActive", () => {
  const rule = {
    id: "hot",
    channel: "chamber",
    message: "Chamber hot",
    priority: "high" as const,
    above: 30,
    deadband: 1,
  };

  it("should activate only past the limit", () => {
    // #when / #then
    expect([ruleActive(rule, 30, 0, false), ruleActive(rule, 30.1, 0, false)]).toEqual([
      false,
      true,
    ]);
  });

  it("should stay active until the value is back past the deadband", () => {
    // #when / #then
    expect([ruleActive(rule, 29.5, 0, true), ruleActive(rule, 28.9, 0, true)]).toEqual([
      true,
      false,
    ]);
  });

  it("should treat a channel that stopped updating as lost", () => {
    // #given
    const lost = { ...rule, above: undefined, staleAfter: 3000 };

    // #when / #then
    expect([ruleActive(lost, 20, 1000, false), ruleActive(lost, 20, 5000, false)]).toEqual([
      false,
      true,
    ]);
  });
});
