// benchcn.dev · pinout-header
// Board pinouts from typed data with an official source, your wiring drawn on top, and
// conflicts called out before the smoke does.
import {
  type ComponentProps,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
  useMemo,
} from "react";

import { cn } from "@/lib/utils";
import type {
  BoardDefinition,
  HeaderDefinition,
  PinDefinition,
} from "@/registry/benchcn/boards/types";
import { INSTRUMENT_FRAME, InstrumentLabel } from "@/registry/benchcn/lib/instrument";
import {
  arrangeHeader,
  type Assignment,
  type BusKind,
  type Conflict,
  findConflicts,
  primaryBus,
} from "@/registry/benchcn/lib/pinout";

export type PinoutHeaderProps = ComponentProps<"div"> & {
  board: BoardDefinition;
  /** Header ids to draw. Defaults to every header. */
  headers?: string[];
  assignments?: Assignment[];
  /** Colour pins by alternate function (buses) or only by kind. */
  colorBy?: "function" | "kind";
  /** Show pin functions next to the names. */
  functions?: boolean;
  /** Columns of pins beside the board, or rows along its edge. */
  orientation?: "vertical" | "horizontal";
  title?: ReactNode;
  onPinClick?: (pin: PinDefinition, header: HeaderDefinition) => void;
};

/** Conventional pinout colours, fixed on purpose: a 5 V pin is red on every board. */
export const PIN_COLORS: Record<
  BusKind | "power5" | "power3" | "power" | "ground" | "gpio" | "reserved" | "nc",
  string
> = {
  power5: "oklch(0.6 0.22 28)",
  power3: "oklch(0.76 0.17 62)",
  power: "oklch(0.7 0.19 45)",
  ground: "oklch(0.32 0.005 260)",
  gpio: "oklch(0.55 0.02 150)",
  reserved: "oklch(0.5 0.01 260)",
  nc: "oklch(0.4 0 0)",
  i2c: "oklch(0.6 0.16 255)",
  spi: "oklch(0.6 0.2 320)",
  uart: "oklch(0.68 0.17 150)",
  pwm: "oklch(0.75 0.15 92)",
  adc: "oklch(0.7 0.13 200)",
};

export function pinColor(pin: PinDefinition, colorBy: "function" | "kind"): string {
  if (pin.kind === "power") {
    if (pin.voltage === 5) return PIN_COLORS.power5;
    if (pin.voltage === 3.3) return PIN_COLORS.power3;
    return PIN_COLORS.power;
  }
  if (pin.kind !== "gpio") return PIN_COLORS[pin.kind];
  if (colorBy === "function") {
    const bus = primaryBus(pin);
    if (bus) return PIN_COLORS[bus];
  }
  return PIN_COLORS.gpio;
}

const NO_ASSIGNMENTS: Assignment[] = [];

export function PinoutHeader({
  board,
  headers,
  assignments = NO_ASSIGNMENTS,
  colorBy = "function",
  functions = true,
  orientation = "vertical",
  title,
  onPinClick,
  className,
  children,
  ...props
}: PinoutHeaderProps): ReactElement {
  const shown = board.headers.filter((h) => !headers || headers.includes(h.id));
  const conflicts = useMemo(() => findConflicts(board, assignments), [board, assignments]);
  const defaultHeader = board.headers[0]?.id;

  const assignmentsFor = (header: HeaderDefinition, pin: PinDefinition) =>
    assignments.filter((a) => (a.header ?? defaultHeader) === header.id && a.pin === pin.number);
  const conflictsFor = (header: HeaderDefinition, pin: PinDefinition) =>
    conflicts.filter((c) => c.header === header.id && c.pins.includes(pin.number));

  return (
    <div data-slot="pinout-header" className={cn(INSTRUMENT_FRAME, "gap-4", className)} {...props}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-col gap-1">
          <InstrumentLabel>{title ?? board.vendor}</InstrumentLabel>
          <span className="text-sm font-medium">{board.name}</span>
        </div>
        <span className="text-muted-foreground text-xs">
          {board.logicLevel} V logic ·{" "}
          <a
            href={board.source.url}
            target="_blank"
            rel="noreferrer"
            className="underline decoration-dotted underline-offset-4"
          >
            source
          </a>
        </span>
      </div>

      <div
        className={cn(
          "flex items-start gap-x-10 gap-y-6",
          orientation === "horizontal" ? "flex-col" : "flex-wrap",
        )}
      >
        {shown.map((header) => (
          <Header
            key={header.id}
            header={header}
            colorBy={colorBy}
            functions={functions}
            orientation={orientation}
            assignmentsFor={(pin) => assignmentsFor(header, pin)}
            conflictsFor={(pin) => conflictsFor(header, pin)}
            onPinClick={onPinClick ? (pin) => onPinClick(pin, header) : undefined}
            many={shown.length > 1}
          />
        ))}
      </div>

      {conflicts.length > 0 ? (
        <ul className="flex flex-col gap-1.5" aria-label="Wiring conflicts">
          {conflicts.map((conflict) => (
            <li
              key={`${conflict.kind}-${conflict.header}-${conflict.pins.join("-")}`}
              className={cn(
                "flex items-start gap-2 text-sm",
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
                className="mt-0.5 size-4 shrink-0"
              >
                <path d="M10 3.5 2.5 16.5h15L10 3.5ZM10 8v4M10 14.2v.3" />
              </svg>
              <span>{conflict.message}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <Legend colorBy={colorBy} />
      {children}
    </div>
  );
}

function Header({
  header,
  colorBy,
  functions,
  orientation,
  assignmentsFor,
  conflictsFor,
  onPinClick,
  many,
}: {
  header: HeaderDefinition;
  colorBy: "function" | "kind";
  functions: boolean;
  orientation: "vertical" | "horizontal";
  assignmentsFor: (pin: PinDefinition) => Assignment[];
  conflictsFor: (pin: PinDefinition) => Conflict[];
  onPinClick?: (pin: PinDefinition) => void;
  many: boolean;
}): ReactElement {
  const columns = arrangeHeader(header);
  const two = columns.length === 2;
  const rows = Math.max(...columns.map((c) => c.length));
  const horizontal = orientation === "horizontal";
  const gridStyle: CSSProperties = horizontal
    ? {
        gridAutoFlow: "column",
        gridTemplateColumns: `repeat(${rows}, 1.5rem)`,
        gridTemplateRows: two ? "auto auto auto auto" : "auto auto",
        columnGap: 4,
        rowGap: two ? 6 : 10,
      }
    : {
        gridTemplateColumns: two ? "1fr auto auto 1fr" : "auto 1fr",
        columnGap: two ? 6 : 10,
        rowGap: 4,
      };

  return (
    <div className={cn("flex flex-col gap-2", horizontal && "max-w-full overflow-x-auto pb-1")}>
      {many ? <InstrumentLabel>{header.label}</InstrumentLabel> : null}
      <ol
        className={cn("grid", horizontal ? "w-max justify-items-center" : "items-center")}
        style={gridStyle}
        aria-label={header.label}
      >
        {Array.from({ length: rows }, (_, r) =>
          columns.map((column, c) => {
            const pin = column[r];
            if (!pin) return null;
            const side = two && c === 0 ? "start" : "end";
            const cells = [
              <PinCell
                key={`pin-${pin.number}`}
                pin={pin}
                color={pinColor(pin, colorBy)}
                assignments={assignmentsFor(pin)}
                conflicts={conflictsFor(pin)}
                onClick={onPinClick}
              />,
              <PinLabel
                key={`label-${pin.number}`}
                pin={pin}
                side={side}
                horizontal={horizontal}
                functions={functions}
                assignments={assignmentsFor(pin)}
                conflicted={conflictsFor(pin).length > 0}
              />,
            ];
            return side === "start" ? cells.reverse() : cells;
          }),
        )}
      </ol>
    </div>
  );
}

function PinCell({
  pin,
  color,
  assignments,
  conflicts,
  onClick,
}: {
  pin: PinDefinition;
  color: string;
  assignments: Assignment[];
  conflicts: Conflict[];
  onClick?: (pin: PinDefinition) => void;
}): ReactElement {
  const assigned = assignments.length > 0;
  const conflicted = conflicts.length > 0;
  const content = (
    <span
      aria-hidden
      className={cn(
        "flex size-6 items-center justify-center rounded-[5px] font-mono text-[10px] font-semibold text-white tabular-nums shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_1px_1px_rgb(0_0_0/0.4)] transition-[box-shadow,transform] duration-100",
        pin.number === 1 && "rounded-[2px]",
        assigned && "ring-foreground ring-2 ring-offset-1 ring-offset-[var(--card)]",
        conflicted && "ring-destructive ring-2",
      )}
      style={{ "--pin": color, background: "var(--pin)" } as CSSProperties}
    >
      {pin.number}
    </span>
  );
  return (
    <li className="contents">
      {onClick ? (
        <button
          type="button"
          onClick={() => onClick(pin)}
          className="focus-visible:ring-ring/50 rounded-[5px] outline-none focus-visible:ring-[3px] active:scale-95"
          aria-label={describePin(pin, assignments)}
        >
          {content}
        </button>
      ) : (
        <span title={describePin(pin, assignments)}>{content}</span>
      )}
    </li>
  );
}

function PinLabel({
  pin,
  side,
  horizontal,
  functions,
  assignments,
  conflicted,
}: {
  pin: PinDefinition;
  /** Which side of the pins the label sits on: left or above for "start". */
  side: "start" | "end";
  horizontal: boolean;
  functions: boolean;
  assignments: Assignment[];
  conflicted: boolean;
}): ReactElement {
  return (
    <li
      className={cn(
        "flex min-w-0 items-center gap-2 font-mono text-[11px] leading-none",
        !horizontal && side === "start" && "flex-row-reverse text-right",
        horizontal && "[writing-mode:vertical-rl]",
        horizontal && "rotate-180",
        horizontal && (side === "start" ? "self-end" : "flex-row-reverse self-start"),
      )}
    >
      <span className={cn("shrink-0 font-medium", pin.kind !== "gpio" && "text-muted-foreground")}>
        {pin.name}
      </span>
      {functions && pin.functions.length > 0 ? (
        <span className="text-muted-foreground truncate">{pin.functions.join(" · ")}</span>
      ) : null}
      {assignments.map((a) => (
        <span
          key={`${a.part}-${a.signal ?? ""}`}
          className={cn(
            "bg-foreground text-background shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-medium",
            conflicted && "bg-destructive text-white",
          )}
        >
          {a.part}
          {a.signal ? ` ${a.signal}` : ""}
        </span>
      ))}
    </li>
  );
}

function describePin(pin: PinDefinition, assignments: Assignment[]): string {
  const parts = [`Pin ${pin.number}, ${pin.name}`];
  if (pin.functions.length) parts.push(pin.functions.join(", "));
  if (pin.note) parts.push(pin.note);
  for (const a of assignments) parts.push(`${a.part}${a.signal ? ` ${a.signal}` : ""}`);
  return parts.join(". ");
}

const LEGEND: { key: keyof typeof PIN_COLORS; label: string; buses?: boolean }[] = [
  { key: "power5", label: "5 V" },
  { key: "power3", label: "3V3" },
  { key: "ground", label: "GND" },
  { key: "gpio", label: "GPIO" },
  { key: "i2c", label: "I2C", buses: true },
  { key: "spi", label: "SPI", buses: true },
  { key: "uart", label: "UART", buses: true },
  { key: "pwm", label: "PWM", buses: true },
  { key: "adc", label: "ADC", buses: true },
  { key: "reserved", label: "Reserved" },
];

function Legend({ colorBy }: { colorBy: "function" | "kind" }): ReactElement {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1.5 border-t pt-3 text-xs">
      {LEGEND.filter((l) => colorBy === "function" || !l.buses).map((item) => (
        <li key={item.key} className="text-muted-foreground inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block size-2.5 rounded-[3px]"
            style={{ background: PIN_COLORS[item.key] }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
