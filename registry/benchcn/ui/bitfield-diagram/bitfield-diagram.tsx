// benchcn.dev · bitfield-diagram
// Register bit layout as a diagram: fields across the bits, reserved bits hatched, the current
// value decoded per field, and bits you can click to edit a register.
import { type ComponentProps, type ReactElement, type ReactNode, useId, useMemo } from "react";

import { cn } from "@/lib/utils";
import {
  type Bitfield,
  fieldValue,
  formatBinary,
  formatHex,
  type LaidOutField,
  layoutBitfield,
  toggleBit,
} from "@/registry/benchcn/lib/bitfield";
import { channelToken, INSTRUMENT_FRAME, InstrumentLabel } from "@/registry/benchcn/lib/instrument";

export type BitfieldDiagramProps = ComponentProps<"div"> & {
  fields: Bitfield[];
  /** Register width. */
  bits?: number;
  /** Current register value; enables per-field decoding. */
  value?: number;
  /** Clicking a bit toggles it and reports the new value. */
  onValueChange?: (value: number) => void;
  /** Bits per row for wide registers. */
  lanes?: number;
  title?: ReactNode;
  /** Register name or address shown next to the title. */
  name?: ReactNode;
  legend?: boolean;
};

const CELL = 30;
const CELL_H = 38;
const NUMBER_H = 14;
const VALUE_H = 16;

export function BitfieldDiagram({
  fields,
  bits = 8,
  value,
  onValueChange,
  lanes,
  title = "Register",
  name,
  legend = true,
  className,
  children,
  ...props
}: BitfieldDiagramProps): ReactElement {
  const id = useId();
  const laid = useMemo(() => layoutBitfield(fields, bits), [fields, bits]);
  const perRow = lanes ?? (bits > 16 ? 16 : bits);
  const rows = Math.ceil(bits / perRow);
  const width = perRow * CELL;
  const rowHeight = NUMBER_H + CELL_H + (value === undefined ? 0 : VALUE_H) + 10;
  const height = rows * rowHeight;
  const named = laid.filter((f) => !f.reserved);
  const colorOf = (field: LaidOutField) => field.color ?? channelToken(named.indexOf(field) + 1);

  const cellX = (bit: number) => {
    const inRow = bit % perRow;
    return (perRow - 1 - inRow) * CELL;
  };
  const rowOf = (bit: number) => rows - 1 - Math.floor(bit / perRow);
  const rowY = (row: number) => row * rowHeight;

  return (
    <div
      data-slot="bitfield-diagram"
      className={cn(INSTRUMENT_FRAME, "gap-3", className)}
      {...props}
    >
      <div className="flex items-baseline justify-between gap-3">
        <InstrumentLabel>{title}</InstrumentLabel>
        <span className="font-mono text-xs tabular-nums">
          {name ? <span className="text-muted-foreground mr-2">{name}</span> : null}
          {value !== undefined ? (
            <>
              {formatHex(value, bits)}{" "}
              <span className="text-muted-foreground">{formatBinary(value, bits)}</span>
            </>
          ) : null}
        </span>
      </div>

      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width={width}
          height={height}
          className="block max-w-full font-mono"
          aria-hidden
        >
          <defs>
            <pattern
              id={`${id}-hatch`}
              width={6}
              height={6}
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <line
                x1={0}
                y1={0}
                x2={0}
                y2={6}
                stroke="currentColor"
                strokeOpacity={0.18}
                strokeWidth={1.5}
              />
            </pattern>
          </defs>
          {Array.from({ length: bits }, (_, bit) => {
            const x = cellX(bit);
            const y = rowY(rowOf(bit)) + NUMBER_H;
            const set = value !== undefined && Math.floor(value / 2 ** bit) % 2 === 1;
            return (
              <g key={bit}>
                <text
                  x={x + CELL / 2}
                  y={NUMBER_H - 4 + rowY(rowOf(bit))}
                  textAnchor="middle"
                  fontSize={9}
                  className="fill-muted-foreground"
                >
                  {bit}
                </text>
                {onValueChange && value !== undefined ? (
                  <rect
                    x={x}
                    y={y}
                    width={CELL}
                    height={CELL_H}
                    fill="transparent"
                    className="hover:fill-opacity-10 cursor-pointer hover:fill-[currentColor]"
                    onClick={() => onValueChange(toggleBit(value, bit))}
                  />
                ) : null}
                {value !== undefined ? (
                  <text
                    x={x + CELL / 2}
                    y={y + CELL_H + VALUE_H - 4}
                    textAnchor="middle"
                    fontSize={10}
                    className={set ? "fill-foreground" : "fill-muted-foreground/60"}
                    style={{ pointerEvents: "none" }}
                  >
                    {set ? 1 : 0}
                  </text>
                ) : null}
              </g>
            );
          })}
          {laid.map((field) => {
            const segments: { row: number; from: number; to: number }[] = [];
            for (let bit = field.lsb; bit <= field.msb; bit += 1) {
              const row = rowOf(bit);
              const last = segments[segments.length - 1];
              if (last && last.row === row) last.to = bit;
              else segments.push({ row, from: bit, to: bit });
            }
            return segments.map((segment) => {
              const x = cellX(segment.to);
              const w = (segment.to - segment.from + 1) * CELL;
              const y = rowY(segment.row) + NUMBER_H;
              const label = field.reserved ? "" : field.name;
              const fits = label.length * 6.5 < w - 6;
              return (
                <g key={`${field.lsb}-${segment.row}`} style={{ pointerEvents: "none" }}>
                  <rect
                    x={x + 0.5}
                    y={y + 0.5}
                    width={w - 1}
                    height={CELL_H - 1}
                    rx={3}
                    fill={field.reserved ? `url(#${id}-hatch)` : colorOf(field)}
                    fillOpacity={field.reserved ? 1 : 0.18}
                    stroke={field.reserved ? "currentColor" : colorOf(field)}
                    strokeOpacity={field.reserved ? 0.25 : 0.9}
                  />
                  {label ? (
                    <text
                      x={x + w / 2}
                      y={y + CELL_H / 2 + 1}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={fits ? 11 : 9}
                      fontWeight={500}
                      className="fill-foreground"
                    >
                      {fits ? label : label.slice(0, Math.max(1, Math.floor((w - 6) / 6)))}
                    </text>
                  ) : null}
                </g>
              );
            });
          })}
        </svg>
      </div>

      {legend ? (
        <table className="w-full border-collapse font-mono text-xs">
          <thead className="text-muted-foreground text-left text-[10px] tracking-[0.08em] uppercase">
            <tr>
              <th className="py-1 pr-3 font-medium">Bits</th>
              <th className="py-1 pr-3 font-medium">Field</th>
              <th className="py-1 pr-3 font-medium">Access</th>
              {value !== undefined ? <th className="py-1 pr-3 font-medium">Value</th> : null}
              <th className="py-1 font-medium">Description</th>
            </tr>
          </thead>
          <tbody>
            {[...laid].reverse().map((field) => {
              const v = value === undefined ? undefined : fieldValue(value, field);
              return (
                <tr key={field.lsb} className="border-t align-top">
                  <td className="py-1.5 pr-3 whitespace-nowrap tabular-nums">
                    {field.width === 1 ? field.lsb : `${field.msb}:${field.lsb}`}
                  </td>
                  <td className="py-1.5 pr-3">
                    {field.reserved ? (
                      <span className="text-muted-foreground">reserved</span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          aria-hidden
                          className="size-2 rounded-[2px]"
                          style={{ background: colorOf(field) }}
                        />
                        {field.name}
                      </span>
                    )}
                  </td>
                  <td className="text-muted-foreground py-1.5 pr-3">{field.access}</td>
                  {v !== undefined ? (
                    <td className="py-1.5 pr-3 whitespace-nowrap tabular-nums">
                      {field.reserved
                        ? ""
                        : `${formatBinary(v, field.width)}${field.values?.[v] ? ` ${field.values[v]}` : ""}`}
                    </td>
                  ) : null}
                  <td className="text-muted-foreground py-1.5 font-sans">{field.description}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : null}
      <p className="sr-only">
        {named.map((f) => `${f.name} bits ${f.msb} to ${f.lsb}`).join(", ")}
        {value !== undefined ? `. Value ${formatHex(value, bits)}.` : "."}
      </p>
      {children}
    </div>
  );
}
