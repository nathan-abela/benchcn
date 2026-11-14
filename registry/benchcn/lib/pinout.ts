// benchcn.dev · pinout
// Physical arrangement of header pins and wiring conflict detection, kept apart from rendering so
// both can be tested and reused in docs tooling.
import type {
  BoardDefinition,
  BusRole,
  HeaderDefinition,
  PinDefinition,
} from "@/registry/benchcn/boards/types";

export type BusKind = "i2c" | "spi" | "uart" | "pwm" | "adc";

export type Assignment = {
  pin: number;
  /** Header id; defaults to the board's first header. */
  header?: string;
  /** Who claims the pin, for example "BME280". */
  part: string;
  /** The part's pin the wire lands on, for example "SDA" or "VIN". */
  signal?: string;
  /**
   * Which function the wire relies on. Needed for bus-role conflicts, and marks the wire as a
   * signal so landing on a power or ground pin is reported. Leave it out for power wires.
   */
  use?: BusKind | "gpio";
  /** Logic level the part drives on a signal wire, in volts; checked against the board. */
  voltage?: number;
  /** Wire colour as you would say it, for example "red"; any CSS colour name draws a swatch. */
  wire?: string;
  note?: string;
};

export type Conflict = {
  kind: "pin" | "bus" | "reserved" | "voltage";
  header: string;
  pins: number[];
  parts: string[];
  message: string;
};

/** Pins in physical order: an array of columns, each top to bottom. */
export function arrangeHeader(header: HeaderDefinition): PinDefinition[][] {
  const sorted = [...header.pins].sort((a, b) => a.number - b.number);
  if (header.columns <= 1 || header.rows <= 1) return [sorted];

  if (header.numbering === "zigzag") {
    const columns: PinDefinition[][] = Array.from({ length: header.columns }, () => []);
    sorted.forEach((pin, i) => columns[i % header.columns].push(pin));
    return columns;
  }

  const perColumn = Math.ceil(sorted.length / header.columns);
  const columns: PinDefinition[][] = [];
  for (let c = 0; c < header.columns; c += 1) {
    const slice = sorted.slice(c * perColumn, (c + 1) * perColumn);
    columns.push(c % 2 === 1 ? slice.reverse() : slice);
  }
  return columns;
}

export function busOf(role: BusRole): { kind: BusKind; id: string } {
  if ("i2c" in role)
    return { kind: "i2c", id: `I2C${role.i2c.bus} ${role.i2c.role.toUpperCase()}` };
  if ("spi" in role)
    return { kind: "spi", id: `SPI${role.spi.bus} ${role.spi.role.toUpperCase()}` };
  if ("uart" in role) {
    return { kind: "uart", id: `UART${role.uart.port} ${role.uart.role.toUpperCase()}` };
  }
  if ("pwm" in role) return { kind: "pwm", id: `PWM ${role.pwm.channel}` };
  return { kind: "adc", id: `ADC ${role.adc.channel}` };
}

/** The bus kind that best describes a pin, for colouring. */
export function primaryBus(pin: PinDefinition): BusKind | null {
  const first = pin.alt?.[0];
  return first ? busOf(first).kind : null;
}

export function findConflicts(board: BoardDefinition, assignments: Assignment[]): Conflict[] {
  const conflicts: Conflict[] = [];
  const defaultHeader = board.headers[0]?.id ?? "";
  const byPin = new Map<string, Assignment[]>();
  const byBusRole = new Map<string, { assignment: Assignment; header: string }[]>();

  for (const assignment of assignments) {
    const headerId = assignment.header ?? defaultHeader;
    const header = board.headers.find((h) => h.id === headerId);
    const pin = header?.pins.find((p) => p.number === assignment.pin);
    if (!header || !pin) continue;

    const key = `${headerId}:${assignment.pin}`;
    byPin.set(key, [...(byPin.get(key) ?? []), assignment]);

    if (assignment.use && pin.kind !== "gpio") {
      conflicts.push({
        kind: "reserved",
        header: headerId,
        pins: [pin.number],
        parts: [assignment.part],
        message: `${assignment.part} uses pin ${pin.number} (${pin.name}), which is ${describeKind(pin)}.`,
      });
    }

    if (assignment.use && pin.kind === "gpio" && (assignment.voltage ?? 0) > board.logicLevel) {
      conflicts.push({
        kind: "voltage",
        header: headerId,
        pins: [pin.number],
        parts: [assignment.part],
        message: `${assignment.part} drives pin ${pin.number} (${pin.name}) at ${assignment.voltage} V, above the board's ${board.logicLevel} V logic.`,
      });
    }

    if (assignment.use && assignment.use !== "gpio") {
      for (const role of pin.alt ?? []) {
        const bus = busOf(role);
        if (bus.kind !== assignment.use) continue;
        const list = byBusRole.get(bus.id) ?? [];
        list.push({ assignment, header: headerId });
        byBusRole.set(bus.id, list);
      }
    }
  }

  for (const [key, list] of byPin) {
    const parts = [...new Set(list.map((a) => a.part))];
    if (parts.length < 2) continue;
    const [header, pin] = key.split(":");
    conflicts.push({
      kind: "pin",
      header,
      pins: [Number(pin)],
      parts,
      message: `Pin ${pin} is claimed by ${parts.join(" and ")}.`,
    });
  }

  for (const [role, list] of byBusRole) {
    const pins = [...new Set(list.map((l) => l.assignment.pin))];
    if (pins.length < 2) continue;
    const parts = [...new Set(list.map((l) => l.assignment.part))];
    conflicts.push({
      kind: "bus",
      header: list[0].header,
      pins,
      parts,
      message: `${role} is routed to pins ${pins.join(" and ")} (${parts.join(", ")}); a bus role can live on one pin.`,
    });
  }

  return conflicts;
}

function describeKind(pin: PinDefinition): string {
  switch (pin.kind) {
    case "power":
      return pin.voltage ? `a ${pin.voltage} V power pin` : "a power pin";
    case "ground":
      return "a ground pin";
    case "reserved":
      return "reserved";
    case "nc":
      return "not connected";
    default:
      return "a GPIO";
  }
}
