import { describe, expect, it } from "vitest";

import {
  type ConnectionTrack,
  connectionDetail,
  connectionState,
  formatAge,
  type LinkStatus,
  trackConnection,
} from "./connection";

function replay(steps: [LinkStatus, number][]): ConnectionTrack {
  let track: ConnectionTrack | null = null;
  steps.forEach(([status, received], i) => {
    track = trackConnection(track, status, received, i * 1000);
  });
  return track as unknown as ConnectionTrack;
}

describe("trackConnection", () => {
  it("should count each new connecting phase as an attempt", () => {
    // #when
    const track = replay([
      ["connecting", 0],
      ["error", 0],
      ["closed", 0],
      ["connecting", 0],
      ["connecting", 0],
      ["closed", 0],
      ["connecting", 0],
    ]);

    // #then
    expect(track.attempts).toBe(3);
  });

  it("should reset attempts once the link opens", () => {
    // #when
    const track = replay([
      ["connecting", 0],
      ["closed", 0],
      ["connecting", 0],
      ["open", 0],
    ]);

    // #then
    expect(track.attempts).toBe(0);
  });

  it("should stamp the time a new message arrived", () => {
    // #when
    const track = replay([
      ["open", 0],
      ["open", 4],
      ["open", 4],
    ]);

    // #then
    expect(track.lastMessageAt).toBe(1000);
  });

  it("should keep the time the link opened while it stays open", () => {
    // #when
    const track = replay([
      ["connecting", 0],
      ["open", 0],
      ["open", 3],
    ]);

    // #then
    expect(track.openedAt).toBe(1000);
  });

  it("should forget the last message when the source is replaced", () => {
    // #when
    const track = replay([
      ["open", 12],
      ["idle", 0],
    ]);

    // #then
    expect(track.lastMessageAt).toBeNull();
  });
});

describe("connectionState", () => {
  it("should go stale when an open link stops sending", () => {
    // #given
    const track = { status: "open" as const, lastMessageAt: 1000, openedAt: 0 };

    // #when
    const states = [5000, 6001].map((now) => connectionState(track, now, 5000));

    // #then
    expect(states).toEqual(["open", "stale"]);
  });

  it("should go stale when an open link never sends", () => {
    // #when / #then
    expect(connectionState({ status: "open", lastMessageAt: null, openedAt: 0 }, 9000, 5000)).toBe(
      "stale",
    );
  });

  it("should pass every other status through", () => {
    // #when / #then
    expect(
      connectionState({ status: "error", lastMessageAt: 0, openedAt: null }, 99_000, 5000),
    ).toBe("error");
  });
});

describe("connectionDetail", () => {
  it("should name the attempt from the second try on", () => {
    // #when
    const details = [1, 2].map((attempts) => connectionDetail("connecting", attempts, null, 0));

    // #then
    expect(details).toEqual([null, "attempt 2"]);
  });

  it("should show the age of the last message once it is two seconds old", () => {
    // #when
    const details = [1500, 12_400].map((age) => connectionDetail("stale", 0, 0, age));

    // #then
    expect(details).toEqual([null, "12 s ago"]);
  });
});

describe("formatAge", () => {
  it("should pick seconds, minutes or hours", () => {
    // #when / #then
    expect([formatAge(59_000), formatAge(125_000), formatAge(7_300_000)]).toEqual([
      "59 s ago",
      "2 min ago",
      "2 h ago",
    ]);
  });
});
