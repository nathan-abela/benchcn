// benchcn.dev · boards
// Types for board pinout data. Every board file cites the official document it was typed from.
export type PinKind = "power" | "ground" | "gpio" | "reserved" | "nc";

export type BusRole =
  | { i2c: { bus: number; role: "sda" | "scl" } }
  | { spi: { bus: number; role: "mosi" | "miso" | "sclk" | "cs" } }
  | { uart: { port: number; role: "tx" | "rx" | "cts" | "rts" } }
  | { pwm: { channel: number | string } }
  | { adc: { channel: number | string } };

export type PinDefinition = {
  /** Physical pin number as printed in the source. */
  number: number;
  /** Primary label as the source writes it, for example `GPIO2`, `3V3`, `GND`, `A0`. */
  name: string;
  kind: PinKind;
  /** Alternate functions, human readable, exactly as the source names them. */
  functions: string[];
  /** Structured roles that feed conflict detection; only where the source is explicit. */
  alt?: BusRole[];
  /** Voltage for power pins, in volts. */
  voltage?: number;
  /** Anything a user must know before wiring, for example "pulled up to 3V3 on board". */
  note?: string;
};

export type HeaderDefinition = {
  id: string;
  label: string;
  /** Physical geometry of the header: pins are numbered as the source numbers them. */
  rows: number;
  columns: number;
  /**
   * How pin numbers run across the header. `zigzag` is the usual 2-column IDC numbering where
   * odd pins sit in one column and even pins in the other; `columns` runs down one side and then
   * the other, as on Arduino-style boards and the Pico edge castellations.
   */
  numbering: "zigzag" | "columns";
  pins: PinDefinition[];
};

export type BoardDefinition = {
  id: string;
  name: string;
  vendor: string;
  source: { title: string; url: string; retrieved: string };
  headers: HeaderDefinition[];
  /** Logic level of the GPIO, in volts. */
  logicLevel: number;
};
