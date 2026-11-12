// benchcn.dev · msgpack
// MessagePack as NetworkTables 4 needs it, from the MessagePack specification (msgpack/msgpack,
// spec.md): nil, booleans, integers up to 64 bits, float 32 and 64, str, bin, arrays and maps.
// No NT4 value type uses extension types, so they are rejected.

export type MsgpackValue =
  | null
  | boolean
  | number
  | string
  | Uint8Array
  | MsgpackValue[]
  | { [key: string]: MsgpackValue };

const TWO_32 = 2 ** 32;

/** Decodes every complete object in `bytes`, in order. Throws on truncated or unsupported data. */
export function decodeMsgpackAll(bytes: Uint8Array): MsgpackValue[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = new TextDecoder();
  let offset = 0;

  const need = (count: number) => {
    if (offset + count > bytes.byteLength) throw new RangeError("msgpack: truncated");
  };
  const take = (count: number): Uint8Array => {
    need(count);
    const slice = bytes.subarray(offset, offset + count);
    offset += count;
    return slice;
  };
  const u8 = () => {
    need(1);
    return view.getUint8(offset++);
  };
  const u16 = () => {
    need(2);
    const v = view.getUint16(offset);
    offset += 2;
    return v;
  };
  const u32 = () => {
    need(4);
    const v = view.getUint32(offset);
    offset += 4;
    return v;
  };
  const read64 = (signed: boolean) => {
    need(8);
    const high = signed ? view.getInt32(offset) : view.getUint32(offset);
    const low = view.getUint32(offset + 4);
    offset += 8;
    // Exact up to 2^53, which covers microsecond timestamps for the next few centuries.
    return high * TWO_32 + low;
  };
  const array = (length: number): MsgpackValue[] => {
    const items: MsgpackValue[] = [];
    for (let i = 0; i < length; i++) items.push(value());
    return items;
  };
  const map = (length: number): { [key: string]: MsgpackValue } => {
    const entries: { [key: string]: MsgpackValue } = {};
    for (let i = 0; i < length; i++) {
      const key = value();
      entries[String(key)] = value();
    }
    return entries;
  };
  const str = (length: number) => text.decode(take(length));

  function value(): MsgpackValue {
    const byte = u8();
    if (byte <= 0x7f) return byte;
    if (byte >= 0xe0) return byte - 0x100;
    if (byte >= 0x80 && byte <= 0x8f) return map(byte & 0x0f);
    if (byte >= 0x90 && byte <= 0x9f) return array(byte & 0x0f);
    if (byte >= 0xa0 && byte <= 0xbf) return str(byte & 0x1f);
    switch (byte) {
      case 0xc0:
        return null;
      case 0xc2:
        return false;
      case 0xc3:
        return true;
      case 0xc4:
        return take(u8()).slice();
      case 0xc5:
        return take(u16()).slice();
      case 0xc6:
        return take(u32()).slice();
      case 0xca: {
        need(4);
        const v = view.getFloat32(offset);
        offset += 4;
        return v;
      }
      case 0xcb: {
        need(8);
        const v = view.getFloat64(offset);
        offset += 8;
        return v;
      }
      case 0xcc:
        return u8();
      case 0xcd:
        return u16();
      case 0xce:
        return u32();
      case 0xcf:
        return read64(false);
      case 0xd0:
        return (u8() << 24) >> 24;
      case 0xd1: {
        need(2);
        const v = view.getInt16(offset);
        offset += 2;
        return v;
      }
      case 0xd2: {
        need(4);
        const v = view.getInt32(offset);
        offset += 4;
        return v;
      }
      case 0xd3:
        return read64(true);
      case 0xd9:
        return str(u8());
      case 0xda:
        return str(u16());
      case 0xdb:
        return str(u32());
      case 0xdc:
        return array(u16());
      case 0xdd:
        return array(u32());
      case 0xde:
        return map(u16());
      case 0xdf:
        return map(u32());
      default:
        throw new TypeError(`msgpack: unsupported format 0x${byte.toString(16)}`);
    }
  }

  const values: MsgpackValue[] = [];
  while (offset < bytes.byteLength) values.push(value());
  return values;
}

export type MsgpackWriter = {
  /** Smallest integer format that holds `n`. */
  int(n: number): MsgpackWriter;
  float64(n: number): MsgpackWriter;
  float32(n: number): MsgpackWriter;
  bool(b: boolean): MsgpackWriter;
  str(s: string): MsgpackWriter;
  arrayHeader(length: number): MsgpackWriter;
  bytes(): Uint8Array<ArrayBuffer>;
};

export function createMsgpackWriter(): MsgpackWriter {
  const chunks: number[] = [];
  const scratch = new DataView(new ArrayBuffer(8));
  const push = (count: number) => {
    for (let i = 0; i < count; i++) chunks.push(scratch.getUint8(i));
  };

  const writer: MsgpackWriter = {
    int(n) {
      if (!Number.isInteger(n)) throw new TypeError(`msgpack: ${n} is not an integer`);
      if (n >= 0) {
        if (n <= 0x7f) chunks.push(n);
        else if (n <= 0xff) chunks.push(0xcc, n);
        else if (n <= 0xffff) {
          chunks.push(0xcd);
          scratch.setUint16(0, n);
          push(2);
        } else if (n <= 0xffffffff) {
          chunks.push(0xce);
          scratch.setUint32(0, n);
          push(4);
        } else {
          chunks.push(0xcf);
          scratch.setUint32(0, Math.floor(n / TWO_32));
          scratch.setUint32(4, n % TWO_32);
          push(8);
        }
      } else if (n >= -32) chunks.push(n & 0xff);
      else if (n >= -0x80) {
        chunks.push(0xd0);
        scratch.setInt8(0, n);
        push(1);
      } else if (n >= -0x8000) {
        chunks.push(0xd1);
        scratch.setInt16(0, n);
        push(2);
      } else if (n >= -0x80000000) {
        chunks.push(0xd2);
        scratch.setInt32(0, n);
        push(4);
      } else {
        const high = Math.floor(n / TWO_32);
        chunks.push(0xd3);
        scratch.setInt32(0, high);
        scratch.setUint32(4, n - high * TWO_32);
        push(8);
      }
      return writer;
    },
    float64(n) {
      chunks.push(0xcb);
      scratch.setFloat64(0, n);
      push(8);
      return writer;
    },
    float32(n) {
      chunks.push(0xca);
      scratch.setFloat32(0, n);
      push(4);
      return writer;
    },
    bool(b) {
      chunks.push(b ? 0xc3 : 0xc2);
      return writer;
    },
    str(s) {
      const encoded = new TextEncoder().encode(s);
      const length = encoded.byteLength;
      if (length <= 31) chunks.push(0xa0 | length);
      else if (length <= 0xff) chunks.push(0xd9, length);
      else if (length <= 0xffff) {
        chunks.push(0xda);
        scratch.setUint16(0, length);
        push(2);
      } else {
        chunks.push(0xdb);
        scratch.setUint32(0, length);
        push(4);
      }
      for (const byte of encoded) chunks.push(byte);
      return writer;
    },
    arrayHeader(length) {
      if (length <= 15) chunks.push(0x90 | length);
      else if (length <= 0xffff) {
        chunks.push(0xdc);
        scratch.setUint16(0, length);
        push(2);
      } else {
        chunks.push(0xdd);
        scratch.setUint32(0, length);
        push(4);
      }
      return writer;
    },
    bytes: () => Uint8Array.from(chunks),
  };
  return writer;
}
