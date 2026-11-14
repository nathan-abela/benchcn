// benchcn.dev · wiring-table
// The written companion to the pinout header: the same wiring as a table, one row per wire, with
// conflicts on the rows they affect and Markdown or CSV for build notes.
import {
  type ComponentProps,
  type ReactElement,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BoardDefinition } from "@/registry/benchcn/boards/types";
import { INSTRUMENT_FRAME, InstrumentLabel } from "@/registry/benchcn/lib/instrument";
import type { Assignment } from "@/registry/benchcn/lib/pinout";
import {
  type WiringColumn,
  type WiringRow,
  wiringCell,
  wiringColumns,
  wiringRows,
  wiringToCsv,
  wiringToMarkdown,
} from "@/registry/benchcn/lib/wiring";

export type WiringTableProps = ComponentProps<"div"> & {
  board: BoardDefinition;
  assignments?: Assignment[];
  title?: ReactNode;
  /** File name for the CSV download, without the extension. */
  exportName?: string;
};

const NO_ASSIGNMENTS: Assignment[] = [];

export function WiringTable({
  board,
  assignments = NO_ASSIGNMENTS,
  title = "Wiring",
  exportName = `${board.id}-wiring`,
  className,
  children,
  ...props
}: WiringTableProps): ReactElement {
  const rows = useMemo(() => wiringRows(board, assignments), [board, assignments]);
  const columns = wiringColumns(rows);
  const groups = groupByPart(rows);
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(wiringToMarkdown(rows));
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div data-slot="wiring-table" className={cn(INSTRUMENT_FRAME, "gap-4", className)} {...props}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col gap-1">
          <InstrumentLabel>{title}</InstrumentLabel>
          <span className="text-sm font-medium">{board.name}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="xs"
            disabled={rows.length === 0}
            onClick={() => void copy()}
          >
            {copied ? "Copied" : "Copy Markdown"}
          </Button>
          <Button
            variant="outline"
            size="xs"
            disabled={rows.length === 0}
            onClick={() => download(exportName, wiringToCsv(rows))}
          >
            Download CSV
          </Button>
          <output className="sr-only">{copied ? "Wiring copied as Markdown" : ""}</output>
        </div>
      </div>

      {/* Seven columns of pin names and notes are wider than a phone; scroll inside the card. */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <caption className="sr-only">Wiring for {board.name}</caption>
          <thead className="text-muted-foreground text-left">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className="py-1 pr-3 font-medium whitespace-nowrap last:pr-0"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          {groups.length === 0 ? (
            <tbody>
              <tr className="border-t">
                <td colSpan={columns.length} className="text-muted-foreground py-1.5">
                  No wires
                </td>
              </tr>
            </tbody>
          ) : (
            groups.map((group) => (
              <tbody key={group[0].part} className="border-t">
                {group.map((row, i) => (
                  <Row
                    key={`${row.header}-${row.pin}-${row.partPin ?? i}`}
                    row={row}
                    columns={columns}
                    span={i === 0 ? group.length : 0}
                  />
                ))}
              </tbody>
            ))
          )}
        </table>
      </div>
      {children}
    </div>
  );
}

const MONO: WiringColumn["key"][] = ["partPin", "pin", "pinName"];

function Row({
  row,
  columns,
  span,
}: {
  row: WiringRow;
  columns: WiringColumn[];
  /** Rows the part cell spans; 0 on every row of a part after the first. */
  span: number;
}): ReactElement {
  const conflicted = row.conflicts.length > 0;
  return (
    <tr className={cn("align-top", span === 0 && "border-border/50 border-t")}>
      {columns.map((column) => {
        if (column.key === "part") {
          return span > 0 ? (
            <th
              key="part"
              scope="rowgroup"
              rowSpan={span}
              className="py-1.5 pr-3 text-left font-medium whitespace-nowrap"
            >
              {row.part}
            </th>
          ) : null;
        }
        return (
          <td
            key={column.key}
            className={cn(
              "py-1.5 pr-3 last:pr-0",
              MONO.includes(column.key) && "font-mono whitespace-nowrap tabular-nums",
              column.key === "function" && "whitespace-nowrap",
              column.key === "pin" && conflicted && "text-destructive font-semibold",
              column.key === "note" && "min-w-48",
            )}
          >
            <Cell row={row} column={column.key} />
          </td>
        );
      })}
    </tr>
  );
}

function Cell({ row, column }: { row: WiringRow; column: WiringColumn["key"] }): ReactElement {
  if (column === "wire" && row.wire) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        <span
          aria-hidden
          className="border-foreground/20 inline-block size-2.5 rounded-full border"
          style={{ background: row.wire }}
        />
        {row.wire}
      </span>
    );
  }
  if (column === "note") {
    if (!row.note && !row.conflicts.length) return <Empty />;
    return (
      <span className="flex flex-col gap-1">
        {row.note ? <span className="text-muted-foreground">{row.note}</span> : null}
        {row.conflicts.map((conflict) => (
          <span
            key={`${conflict.kind}-${conflict.pins.join("-")}`}
            className={cn(
              "flex items-start gap-1.5",
              conflict.kind === "reserved" ? "text-warning" : "text-destructive",
            )}
          >
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
              className="mt-px size-3.5 shrink-0"
            >
              <path d="M10 3.5 2.5 16.5h15L10 3.5ZM10 8v4M10 14.2v.3" />
            </svg>
            {conflict.message}
          </span>
        ))}
      </span>
    );
  }
  const text = wiringCell(row, column);
  return text ? <>{text}</> : <Empty />;
}

function Empty(): ReactElement {
  return <span className="text-muted-foreground">--</span>;
}

function groupByPart(rows: WiringRow[]): WiringRow[][] {
  const groups: WiringRow[][] = [];
  for (const row of rows) {
    const last = groups.at(-1);
    if (last && last[0].part === row.part) last.push(row);
    else groups.push([row]);
  }
  return groups;
}

function download(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${name}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
