import { describe, expect, it } from "vitest";

import { arduinoUnoR3, raspberryPi40Pin, raspberryPiPico } from "@/registry/benchcn/boards";

import type { Assignment } from "./pinout";
import { wiringColumns, wiringRows, wiringToCsv, wiringToMarkdown } from "./wiring";

const BME280: Assignment[] = [
  { pin: 9, part: "BME280", signal: "GND", wire: "black" },
  { pin: 3, part: "BME280", signal: "SDA", use: "i2c", wire: "blue" },
  { pin: 1, part: "BME280", signal: "VIN", wire: "red" },
];

describe("wiringRows", () => {
  it("should group rows by part in order of appearance, then sort by pin", () => {
    // #given
    const assignments: Assignment[] = [
      { pin: 11, part: "Relay", signal: "IN", use: "gpio" },
      ...BME280,
      { pin: 6, part: "Relay", signal: "GND" },
    ];

    // #when
    const rows = wiringRows(raspberryPi40Pin, assignments);

    // #then
    expect(rows.map((r) => `${r.part} ${r.pin}`)).toEqual([
      "Relay 6",
      "Relay 11",
      "BME280 1",
      "BME280 3",
      "BME280 9",
    ]);
  });

  it("should name the bus role the wire relies on", () => {
    // #when
    const [row] = wiringRows(raspberryPi40Pin, [
      { pin: 3, part: "BME280", signal: "SDA", use: "i2c" },
    ]);

    // #then
    expect([row.pinName, row.function]).toEqual(["GP2", "I2C1 SDA"]);
  });

  it("should describe power and ground pins by kind", () => {
    // #when
    const rows = wiringRows(raspberryPi40Pin, BME280);

    // #then
    expect(rows.map((r) => r.function)).toEqual(["Power", "I2C1 SDA", "Ground"]);
  });

  it("should attach a pin conflict to both parts on the pin", () => {
    // #when
    const rows = wiringRows(raspberryPi40Pin, [
      { pin: 11, part: "Relay", use: "gpio" },
      { pin: 11, part: "Buzzer", use: "gpio" },
    ]);

    // #then
    expect(rows.map((r) => r.conflicts.map((c) => c.kind))).toEqual([["pin"], ["pin"]]);
  });

  it("should attach a bus conflict only to the rows on the duplicated role", () => {
    // #given I2C0 SDA on GP0 (pin 1) and GP4 (pin 6) of the Pico
    const rows = wiringRows(raspberryPiPico, [
      { pin: 1, part: "OLED", signal: "SDA", use: "i2c" },
      { pin: 2, part: "OLED", signal: "SCL", use: "i2c" },
      { pin: 6, part: "BME280", signal: "SDA", use: "i2c" },
    ]);

    // #then
    expect(rows.map((r) => [r.pin, r.conflicts.length])).toEqual([
      [1, 1],
      [2, 0],
      [6, 1],
    ]);
  });

  it("should keep a wire to a pin the board does not have, without a name", () => {
    // #when
    const [row] = wiringRows(raspberryPi40Pin, [{ pin: 99, part: "Ghost" }]);

    // #then
    expect([row.pin, row.pinName]).toEqual([99, undefined]);
  });

  it("should return no rows for no assignments", () => {
    // #when / #then
    expect(wiringRows(raspberryPi40Pin, [])).toEqual([]);
  });
});

describe("wiringColumns", () => {
  it("should leave out the header, wire and note columns when nothing uses them", () => {
    // #when
    const rows = wiringRows(raspberryPi40Pin, [{ pin: 11, part: "Relay", use: "gpio" }]);

    // #then
    expect(wiringColumns(rows).map((c) => c.key)).toEqual([
      "part",
      "partPin",
      "pin",
      "pinName",
      "function",
    ]);
  });

  it("should add the header column when wires span headers", () => {
    // #given
    const rows = wiringRows(arduinoUnoR3, [
      { pin: 5, header: "power", part: "Servo", signal: "V+" },
      { pin: 2, header: "digital-low", part: "Servo", signal: "SIG", use: "pwm" },
    ]);

    // #then
    expect(wiringColumns(rows).some((c) => c.key === "header")).toBe(true);
  });

  it("should add the note column when a row has a conflict but no note", () => {
    // #when
    const rows = wiringRows(raspberryPi40Pin, [
      { pin: 11, part: "Buzzer", use: "gpio", voltage: 5 },
    ]);

    // #then
    expect(wiringColumns(rows).some((c) => c.key === "note")).toBe(true);
  });
});

describe("wiringToMarkdown", () => {
  it("should print a table with -- in empty cells", () => {
    // #when
    const markdown = wiringToMarkdown(
      wiringRows(raspberryPi40Pin, [{ pin: 11, part: "Relay", use: "gpio" }]),
    );

    // #then
    expect(markdown).toBe(
      [
        "| Part | Part pin | Pin | Name | Function |",
        "| --- | --- | --- | --- | --- |",
        "| Relay | -- | 11 | GP17 | GPIO |",
      ].join("\n"),
    );
  });

  it("should escape pipes inside cells", () => {
    // #when
    const markdown = wiringToMarkdown(
      wiringRows(raspberryPi40Pin, [{ pin: 1, part: "A|B", signal: "VIN" }]),
    );

    // #then
    expect(markdown.split("\n")[2]).toBe("| A\\|B | VIN | 1 | 3V3 | Power |");
  });

  it("should append conflicts to the note", () => {
    // #when
    const markdown = wiringToMarkdown(
      wiringRows(raspberryPi40Pin, [
        { pin: 11, part: "Buzzer", use: "gpio", voltage: 5, note: "Active high." },
      ]),
    );

    // #then
    expect(markdown).toContain(
      "| Active high. Buzzer drives pin 11 (GP17) at 5 V, above the board's 3.3 V logic. |",
    );
  });
});

describe("wiringToCsv", () => {
  it("should quote cells with commas and leave empty cells empty", () => {
    // #when
    const csv = wiringToCsv(
      wiringRows(raspberryPi40Pin, [
        { pin: 3, part: "BME280", use: "i2c", wire: "blue", note: "Pull-up on board, 1.8k" },
      ]),
    );

    // #then
    expect(csv).toBe(
      [
        "Part,Part pin,Pin,Name,Function,Wire,Note",
        'BME280,,3,GP2,I2C1 SDA,blue,"Pull-up on board, 1.8k"',
      ].join("\n"),
    );
  });
});
