import { describe, expect, it } from "vitest";

import { arduinoUnoR3, raspberryPi40Pin, raspberryPiPico } from "@/registry/benchcn/boards";

import { arrangeHeader, findConflicts } from "./pinout";

describe("arrangeHeader", () => {
  it("should put odd pins in the left column for zigzag headers", () => {
    // #when
    const [left, right] = arrangeHeader(raspberryPi40Pin.headers[0]);

    // #then
    expect({
      left: left.slice(0, 3).map((p) => p.number),
      right: right.slice(0, 3).map((p) => p.number),
    }).toEqual({ left: [1, 3, 5], right: [2, 4, 6] });
  });

  it("should run the second column upwards for column-numbered headers", () => {
    // #when
    const [left, right] = arrangeHeader(raspberryPiPico.headers[0]);

    // #then
    expect({
      leftTop: left[0].number,
      leftBottom: left[19].number,
      rightTop: right[0].number,
      rightBottom: right[19].number,
    }).toEqual({ leftTop: 1, leftBottom: 20, rightTop: 40, rightBottom: 21 });
  });

  it("should return one sorted column for single-column headers", () => {
    // #when
    const columns = arrangeHeader(raspberryPiPico.headers[1]);

    // #then
    expect(columns.map((c) => c.map((p) => p.number))).toEqual([[1, 2, 3]]);
  });
});

describe("findConflicts", () => {
  it("should report nothing for a clean wiring", () => {
    // #given a sensor on I2C1 and a relay on a free GPIO
    const assignments = [
      { pin: 3, part: "BME280", signal: "SDA", use: "i2c" as const },
      { pin: 5, part: "BME280", signal: "SCL", use: "i2c" as const },
      { pin: 11, part: "Relay", signal: "IN", use: "gpio" as const },
    ];

    // #when / #then
    expect(findConflicts(raspberryPi40Pin, assignments)).toEqual([]);
  });

  it("should flag two parts on the same pin", () => {
    // #when
    const conflicts = findConflicts(raspberryPi40Pin, [
      { pin: 11, part: "Relay" },
      { pin: 11, part: "Buzzer" },
    ]);

    // #then
    expect(conflicts.map((c) => [c.kind, c.pins, c.parts])).toEqual([
      ["pin", [11], ["Relay", "Buzzer"]],
    ]);
  });

  it("should flag a bus role routed to two pins", () => {
    // #given I2C0 SDA is available on GP0 (pin 1) and GP4 (pin 6) of the Pico
    const conflicts = findConflicts(raspberryPiPico, [
      { pin: 1, part: "OLED", signal: "SDA", use: "i2c" },
      { pin: 6, part: "BME280", signal: "SDA", use: "i2c" },
    ]);

    // #then
    expect(conflicts.map((c) => [c.kind, c.pins.sort()])).toEqual([["bus", [1, 6]]]);
  });

  it("should not flag the same bus on different roles", () => {
    // #given SDA and SCL of the same bus
    const conflicts = findConflicts(raspberryPiPico, [
      { pin: 1, part: "OLED", signal: "SDA", use: "i2c" },
      { pin: 2, part: "OLED", signal: "SCL", use: "i2c" },
    ]);

    // #then
    expect(conflicts).toEqual([]);
  });

  it("should not flag power wires on power pins", () => {
    // #when
    const conflicts = findConflicts(raspberryPi40Pin, [
      { pin: 1, part: "BME280", signal: "VIN" },
      { pin: 9, part: "BME280", signal: "GND" },
    ]);

    // #then
    expect(conflicts).toEqual([]);
  });

  it("should warn when a signal is put on a power or ground pin", () => {
    // #when
    const conflicts = findConflicts(raspberryPi40Pin, [{ pin: 2, part: "LED", use: "gpio" }]);

    // #then
    expect(conflicts.map((c) => c.kind)).toEqual(["reserved"]);
  });

  it("should flag a 5 V signal on a 3.3 V logic board", () => {
    // #when
    const conflicts = findConflicts(raspberryPi40Pin, [
      { pin: 11, part: "Buzzer", use: "gpio", voltage: 5 },
    ]);

    // #then
    expect(conflicts.map((c) => [c.kind, c.pins])).toEqual([["voltage", [11]]]);
  });

  it("should accept a 5 V signal on a 5 V logic board", () => {
    // #when
    const conflicts = findConflicts(arduinoUnoR3, [
      { pin: 1, header: "digital-low", part: "Buzzer", use: "gpio", voltage: 5 },
    ]);

    // #then
    expect(conflicts).toEqual([]);
  });

  it("should ignore assignments to pins that do not exist", () => {
    // #when / #then
    expect(findConflicts(raspberryPi40Pin, [{ pin: 99, part: "Ghost" }])).toEqual([]);
  });
});
