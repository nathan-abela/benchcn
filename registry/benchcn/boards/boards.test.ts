// benchcn.dev · boards
import { describe, expect, it } from "vitest";

import {
  arduinoUnoR3,
  boards,
  esp32DevkitcV4,
  raspberryPi40Pin,
  raspberryPiPico,
} from "@/registry/benchcn/boards";
import type { BoardDefinition, PinDefinition } from "@/registry/benchcn/boards/types";

function allPins(board: BoardDefinition): PinDefinition[] {
  return board.headers.flatMap((header) => header.pins);
}

function findPin(board: BoardDefinition, name: string): PinDefinition {
  const pin = allPins(board).find((candidate) => candidate.name === name);
  if (!pin) throw new Error(`${board.id} has no pin named ${name}`);
  return pin;
}

function i2cRoles(board: BoardDefinition): Map<number, { sda: number; scl: number }> {
  const buses = new Map<number, { sda: number; scl: number }>();
  for (const pin of allPins(board)) {
    for (const entry of pin.alt ?? []) {
      if (!("i2c" in entry)) continue;
      const bus = buses.get(entry.i2c.bus) ?? { sda: 0, scl: 0 };
      bus[entry.i2c.role] += 1;
      buses.set(entry.i2c.bus, bus);
    }
  }
  return buses;
}

describe.each(boards.map((board) => [board.id, board] as const))("%s", (_id, board) => {
  it("numbers pins uniquely within each header", () => {
    // #given
    const headers = board.headers;

    // #when
    const duplicates = headers.filter(
      (header) => new Set(header.pins.map((pin) => pin.number)).size !== header.pins.length,
    );

    // #then
    expect(duplicates.map((header) => header.id)).toEqual([]);
  });

  it("has as many pins per header as its geometry", () => {
    // #given
    const headers = board.headers;

    // #when
    const mismatched = headers.filter(
      (header) => header.pins.length !== header.rows * header.columns,
    );

    // #then
    expect(mismatched.map((header) => header.id)).toEqual([]);
  });

  it("pairs every I2C bus role as sda/scl", () => {
    // #given
    const buses = i2cRoles(board);

    // #when
    const unpaired = [...buses.entries()].filter(([, roles]) => roles.sda !== roles.scl);

    // #then
    expect(unpaired).toEqual([]);
  });

  it("states a voltage, or documents the range, on every power pin", () => {
    // #given
    const powerPins = allPins(board).filter((pin) => pin.kind === "power");

    // #when
    const unspecified = powerPins.filter((pin) => pin.voltage === undefined && !pin.note);

    // #then
    expect(unspecified.map((pin) => pin.name)).toEqual([]);
  });
});

describe("raspberry-pi-40pin", () => {
  it("has eight ground pins", () => {
    // #given
    const pins = allPins(raspberryPi40Pin);

    // #when
    const grounds = pins.filter((pin) => pin.kind === "ground");

    // #then
    expect(grounds).toHaveLength(8);
  });

  it("carries I2C1 SDA on GP2 and SCL on GP3", () => {
    // #given
    const sda = findPin(raspberryPi40Pin, "GP2");
    const scl = findPin(raspberryPi40Pin, "GP3");

    // #when
    const roles = [sda.alt, scl.alt];

    // #then
    expect(roles).toEqual([[{ i2c: { bus: 1, role: "sda" } }], [{ i2c: { bus: 1, role: "scl" } }]]);
  });
});

describe("raspberry-pi-pico", () => {
  it("maps GP26-GP28 to ADC channels 0-2", () => {
    // #given
    const names = ["GP26", "GP27", "GP28"];

    // #when
    const channels = names.map((name) =>
      findPin(raspberryPiPico, name).alt?.flatMap((entry) =>
        "adc" in entry ? [entry.adc.channel] : [],
      ),
    );

    // #then
    expect(channels).toEqual([[0], [1], [2]]);
  });
});

describe("esp32-devkitc-v4", () => {
  it("has 38 pins across both headers", () => {
    // #given
    const headers = esp32DevkitcV4.headers;

    // #when
    const total = headers.reduce((sum, header) => sum + header.pins.length, 0);

    // #then
    expect(total).toBe(38);
  });
});

describe("arduino-uno-r3", () => {
  it("has PWM on D3, D5, D6, D9, D10 and D11", () => {
    // #given
    const pins = allPins(arduinoUnoR3);

    // #when
    const pwmPins = pins
      .filter((pin) => pin.alt?.some((entry) => "pwm" in entry))
      .map((pin) => pin.name)
      .sort();

    // #then
    expect(pwmPins).toEqual(["D10", "D11", "D3", "D5", "D6", "D9"]);
  });
});
