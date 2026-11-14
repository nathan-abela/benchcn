// benchcn.dev · wiring-table
// One row per wire from the same assignments the pinout header draws, grouped by part because a
// build goes one part at a time, plus Markdown and CSV for build notes.
import type { BoardDefinition, PinDefinition } from "@/registry/benchcn/boards/types";
import {
  type Assignment,
  busOf,
  type Conflict,
  findConflicts,
} from "@/registry/benchcn/lib/pinout";

export type WiringRow = {
  part: string;
  partPin?: string;
  header: string;
  headerLabel: string;
  pin: number;
  /** Undefined when the board has no such pin. */
  pinName?: string;
  function?: string;
  wire?: string;
  note?: string;
  conflicts: Conflict[];
};

export type WiringColumn = {
  key: "part" | "partPin" | "header" | "pin" | "pinName" | "function" | "wire" | "note";
  label: string;
};

const COLUMNS: WiringColumn[] = [
  { key: "part", label: "Part" },
  { key: "partPin", label: "Part pin" },
  { key: "header", label: "Header" },
  { key: "pin", label: "Pin" },
  { key: "pinName", label: "Name" },
  { key: "function", label: "Function" },
  { key: "wire", label: "Wire" },
  { key: "note", label: "Note" },
];

export function wiringRows(board: BoardDefinition, assignments: Assignment[]): WiringRow[] {
  const conflicts = findConflicts(board, assignments);
  const defaultHeader = board.headers[0]?.id ?? "";
  const headerIndex = (id: string) => board.headers.findIndex((h) => h.id === id);
  const partOrder = [...new Set(assignments.map((a) => a.part))];

  return assignments
    .map((assignment): WiringRow => {
      const headerId = assignment.header ?? defaultHeader;
      const header = board.headers.find((h) => h.id === headerId);
      const pin = header?.pins.find((p) => p.number === assignment.pin);
      return {
        part: assignment.part,
        partPin: assignment.signal,
        header: headerId,
        headerLabel: header?.label ?? headerId,
        pin: assignment.pin,
        pinName: pin?.name,
        function: pin ? functionOf(pin, assignment) : undefined,
        wire: assignment.wire,
        note: assignment.note,
        conflicts: conflicts.filter(
          (c) =>
            c.header === headerId &&
            c.pins.includes(assignment.pin) &&
            c.parts.includes(assignment.part),
        ),
      };
    })
    .sort(
      (a, b) =>
        partOrder.indexOf(a.part) - partOrder.indexOf(b.part) ||
        headerIndex(a.header) - headerIndex(b.header) ||
        a.pin - b.pin,
    );
}

/** What the board pin does on this wire: the bus role it relies on, or the pin's kind. */
function functionOf(pin: PinDefinition, assignment: Assignment): string | undefined {
  const { use } = assignment;
  if (use && use !== "gpio") {
    const bus = pin.alt?.map(busOf).find((b) => b.kind === use);
    return bus?.id ?? (pin.functions.join(", ") || undefined);
  }
  if (use === "gpio") return "GPIO";
  if (pin.kind === "power") return "Power";
  if (pin.kind === "ground") return "Ground";
  return pin.functions.join(", ") || undefined;
}

/** Columns worth printing: the header only when wires span headers, wire and note when used. */
export function wiringColumns(rows: WiringRow[]): WiringColumn[] {
  const headers = new Set(rows.map((r) => r.header));
  return COLUMNS.filter((column) => {
    if (column.key === "header") return headers.size > 1;
    if (column.key === "wire") return rows.some((r) => r.wire);
    if (column.key === "note") return rows.some((r) => r.note || r.conflicts.length > 0);
    return true;
  });
}

/** Plain text for one cell, with conflicts appended to the note. */
export function wiringCell(row: WiringRow, key: WiringColumn["key"]): string {
  switch (key) {
    case "header":
      return row.headerLabel;
    case "pin":
      return String(row.pin);
    case "note":
      return [row.note, ...row.conflicts.map((c) => c.message)].filter(Boolean).join(" ");
    default:
      return row[key] ?? "";
  }
}

/** A GFM table; empty cells read `--`. */
export function wiringToMarkdown(rows: WiringRow[]): string {
  const columns = wiringColumns(rows);
  const escape = (text: string) => text.replaceAll("|", "\\|").replaceAll("\n", " ");
  const line = (cells: string[]) => `| ${cells.map(escape).join(" | ")} |`;
  return [
    line(columns.map((c) => c.label)),
    line(columns.map(() => "---")),
    ...rows.map((row) => line(columns.map((c) => wiringCell(row, c.key) || "--"))),
  ].join("\n");
}

const csvCell = (text: string): string =>
  /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;

/** Same columns as the Markdown; empty cells stay empty so a spreadsheet can sort them. */
export function wiringToCsv(rows: WiringRow[]): string {
  const columns = wiringColumns(rows);
  return [
    columns.map((c) => c.label),
    ...rows.map((row) => columns.map((c) => wiringCell(row, c.key))),
  ]
    .map((cells) => cells.map(csvCell).join(","))
    .join("\n");
}
