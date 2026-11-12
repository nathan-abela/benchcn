import { describe, expect, it } from "vitest";

import { createMsgpackWriter, decodeMsgpackAll } from "./msgpack";

// The 17-byte double value update from the NT4 spec, section "Binary Data Frames".
const SPEC_DOUBLE_UPDATE = Uint8Array.from([
  0x94, 0x32, 0xd2, 0x07, 0x27, 0x0e, 0x00, 0x01, 0xcb, 0x3f, 0xbf, 0x97, 0x24, 0x74, 0x53, 0x8e,
  0xf3,
]);

describe("decodeMsgpackAll", () => {
  it("should decode the spec's double value update", () => {
    // #given the bytes from the spec

    // #when
    const values = decodeMsgpackAll(SPEC_DOUBLE_UPDATE);

    // #then topic 50, two minutes in microseconds, type double, 0.1234
    expect(values).toEqual([[50, 120_000_000, 1, 0.1234]]);
  });

  it("should decode several objects back to back", () => {
    // #given two complete arrays in one frame
    const frame = new Uint8Array([...SPEC_DOUBLE_UPDATE, ...SPEC_DOUBLE_UPDATE]);

    // #when
    const values = decodeMsgpackAll(frame);

    // #then
    expect(values).toHaveLength(2);
  });

  it("should reject a truncated object", () => {
    // #given the spec example missing its last byte
    const truncated = SPEC_DOUBLE_UPDATE.subarray(0, 16);

    // #when
    const decode = () => decodeMsgpackAll(truncated);

    // #then
    expect(decode).toThrow(RangeError);
  });

  it("should decode maps, strings, nil and binary", () => {
    // #given {"a": nil, "b": bin [1, 2]}
    const bytes = Uint8Array.from([0x82, 0xa1, 0x61, 0xc0, 0xa1, 0x62, 0xc4, 0x02, 0x01, 0x02]);

    // #when
    const [value] = decodeMsgpackAll(bytes);

    // #then
    expect(value).toEqual({ a: null, b: Uint8Array.from([1, 2]) });
  });
});

describe("createMsgpackWriter", () => {
  it("should encode the spec's double value update in 17 bytes", () => {
    // #given
    const writer = createMsgpackWriter().arrayHeader(4).int(50).int(120_000_000).int(1);

    // #when
    const bytes = writer.float64(0.1234).bytes();

    // #then the same size as the spec's example, with the same double encoding
    expect({
      length: bytes.length,
      double: [...bytes.subarray(8)],
      decoded: decodeMsgpackAll(bytes),
    }).toEqual({
      length: 17,
      double: [0xcb, 0x3f, 0xbf, 0x97, 0x24, 0x74, 0x53, 0x8e, 0xf3],
      decoded: [[50, 120_000_000, 1, 0.1234]],
    });
  });

  it("should round-trip integers across every width", () => {
    // #given values at each format boundary, including epoch microseconds
    const values = [
      0, 127, 128, 255, 256, 65_535, 65_536, 4_294_967_295, 4_294_967_296, 1_731_000_000_000_000,
      -1, -32, -33, -128, -129, -32_768, -32_769, -2_147_483_648, -2_147_483_649,
    ];

    // #when
    const writer = createMsgpackWriter();
    for (const n of values) writer.int(n);
    const decoded = decodeMsgpackAll(writer.bytes());

    // #then
    expect(decoded).toEqual(values);
  });

  it("should round-trip strings, booleans and float32", () => {
    // #given
    const long = "x".repeat(300);

    // #when
    const bytes = createMsgpackWriter().str("µs").str(long).bool(true).float32(0.5).bytes();

    // #then
    expect(decodeMsgpackAll(bytes)).toEqual(["µs", long, true, 0.5]);
  });
});
