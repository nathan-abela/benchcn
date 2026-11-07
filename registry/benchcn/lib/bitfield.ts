// benchcn.dev · bitfield-diagram
// Register layout maths: fields by width (LSB first, as WaveDrom's bitfield does) or by explicit
// bit range, gaps filled with reserved bits, and value extraction with 32-bit safe arithmetic.
export type BitfieldAccess = "RW" | "RO" | "WO" | "W1C" | "RSVD";

export type Bitfield = {
  name: string;
  /** Width in bits (placed after the previous field, LSB first) or an explicit `[lsb, msb]`. */
  bits: number | [lsb: number, msb: number];
  access?: BitfieldAccess;
  description?: string;
  /** Names for enumerated values. */
  values?: Record<number, string>;
  /** Any CSS colour. Defaults to `--channel-n` by position. */
  color?: string;
};

export type LaidOutField = {
  name: string;
  lsb: number;
  msb: number;
  width: number;
  access: BitfieldAccess;
  description?: string;
  values?: Record<number, string>;
  color?: string;
  reserved: boolean;
};

/** Resolves fields into non-overlapping ranges covering `bits`, reserved where nothing is named. */
export function layoutBitfield(fields: Bitfield[], bits: number): LaidOutField[] {
  const out: LaidOutField[] = [];
  let cursor = 0;
  for (const field of fields) {
    let lsb: number;
    let msb: number;
    if (typeof field.bits === "number") {
      lsb = cursor;
      msb = cursor + field.bits - 1;
    } else {
      [lsb, msb] = field.bits[0] <= field.bits[1] ? field.bits : [field.bits[1], field.bits[0]];
    }
    if (lsb < 0 || msb >= bits) {
      throw new RangeError(`Field "${field.name}" (${lsb}:${msb}) does not fit in ${bits} bits.`);
    }
    for (const other of out) {
      if (lsb <= other.msb && msb >= other.lsb) {
        throw new RangeError(`Field "${field.name}" overlaps "${other.name}".`);
      }
    }
    out.push({
      name: field.name,
      lsb,
      msb,
      width: msb - lsb + 1,
      access: field.access ?? (field.name.toLowerCase().includes("reserved") ? "RSVD" : "RW"),
      description: field.description,
      values: field.values,
      color: field.color,
      reserved: field.access === "RSVD",
    });
    cursor = msb + 1;
  }

  out.sort((a, b) => a.lsb - b.lsb);
  const filled: LaidOutField[] = [];
  let next = 0;
  for (const field of out) {
    if (field.lsb > next) filled.push(reserved(next, field.lsb - 1));
    filled.push(field);
    next = field.msb + 1;
  }
  if (next < bits) filled.push(reserved(next, bits - 1));
  return filled;
}

function reserved(lsb: number, msb: number): LaidOutField {
  return { name: "", lsb, msb, width: msb - lsb + 1, access: "RSVD", reserved: true };
}

export function fieldValue(value: number, field: Pick<LaidOutField, "lsb" | "width">): number {
  const shifted = Math.floor(value / 2 ** field.lsb);
  return shifted % 2 ** field.width;
}

export function withFieldValue(
  value: number,
  field: Pick<LaidOutField, "lsb" | "width">,
  next: number,
): number {
  const mask = (2 ** field.width - 1) * 2 ** field.lsb;
  const cleared = value - (value % 2 ** (field.lsb + field.width)) + (value % 2 ** field.lsb);
  return cleared + (next % 2 ** field.width) * 2 ** field.lsb * (mask ? 1 : 0);
}

export function toggleBit(value: number, bit: number): number {
  const weight = 2 ** bit;
  return Math.floor(value / weight) % 2 === 1 ? value - weight : value + weight;
}

export function formatBinary(value: number, width: number): string {
  return value.toString(2).padStart(width, "0");
}

export function formatHex(value: number, bits: number): string {
  return `0x${value
    .toString(16)
    .toUpperCase()
    .padStart(Math.ceil(bits / 4), "0")}`;
}
