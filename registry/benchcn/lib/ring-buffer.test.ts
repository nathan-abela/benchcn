import { describe, expect, it } from "vitest";

import { RingBuffer } from "./ring-buffer";

function filled(capacity: number, count: number): RingBuffer {
  const buffer = new RingBuffer({ capacity });
  for (let i = 1; i <= count; i += 1) buffer.push(i, i * 10);
  return buffer;
}

describe("RingBuffer", () => {
  describe("constructor", () => {
    it("should reject a non-positive capacity", () => {
      // #when / #then
      expect(() => new RingBuffer({ capacity: 0 })).toThrow(RangeError);
    });
  });

  describe("push", () => {
    it("should keep insertion order before wrapping", () => {
      // #given
      const buffer = filled(4, 2);

      // #then
      expect(Array.from(buffer.tail().values)).toEqual([10, 20]);
    });

    it("should expose the newest sample as latest", () => {
      // #given
      const buffer = filled(4, 2);

      // #then
      expect(buffer.latest).toEqual({ time: 2, value: 20 });
    });

    it("should overwrite the oldest samples after wrapping", () => {
      // #given a capacity of 3 and five pushes
      const buffer = filled(3, 5);

      // #then only the last three remain, oldest first
      expect(Array.from(buffer.tail().times)).toEqual([3, 4, 5]);
    });

    it("should cap length at capacity", () => {
      // #given
      const buffer = filled(3, 5);

      // #then
      expect(buffer.length).toBe(3);
    });

    it("should index logically after wrapping", () => {
      // #given
      const buffer = filled(3, 5);

      // #then
      expect([buffer.timeAt(0), buffer.valueAt(2)]).toEqual([3, 50]);
    });
  });

  describe("pushBlock", () => {
    it("should space samples by the sample rate", () => {
      // #given
      const buffer = new RingBuffer({ capacity: 10 });

      // #when 3 samples at 1 kHz starting at t=1000 ms
      buffer.pushBlock(1000, [1, 2, 3], 1000);

      // #then
      expect(Array.from(buffer.tail().times)).toEqual([1000, 1001, 1002]);
    });
  });

  describe("tail", () => {
    it("should return the last n values", () => {
      // #given
      const buffer = filled(3, 5);

      // #then
      expect(Array.from(buffer.tail(2).values)).toEqual([40, 50]);
    });
  });

  describe("since", () => {
    const buffer = new RingBuffer({ capacity: 8 });
    for (let t = 0; t < 8; t += 1) buffer.push(t * 100, t);

    it("should return samples at or after the cutoff", () => {
      // #then
      expect(Array.from(buffer.since(350).values)).toEqual([4, 5, 6, 7]);
    });

    it("should return nothing when the cutoff is in the future", () => {
      // #then
      expect(buffer.since(10_000).values).toHaveLength(0);
    });

    it("should return everything when the cutoff precedes all samples", () => {
      // #then
      expect(buffer.since(-1).values).toHaveLength(8);
    });
  });

  describe("extent", () => {
    it("should return min and max over all samples", () => {
      // #given
      const buffer = new RingBuffer({ capacity: 5, precision: "f32" });
      [5, -2, 9, 1].forEach((v, i) => buffer.push(i, v));

      // #then
      expect(buffer.extent()).toEqual({ min: -2, max: 9 });
    });

    it("should limit the extent to the tail", () => {
      // #given
      const buffer = new RingBuffer({ capacity: 5 });
      [5, -2, 9, 1].forEach((v, i) => buffer.push(i, v));

      // #then
      expect(buffer.extent(2)).toEqual({ min: 1, max: 9 });
    });

    it("should be undefined when empty", () => {
      // #then
      expect(new RingBuffer({ capacity: 2 }).extent()).toBeUndefined();
    });
  });

  describe("clear", () => {
    it("should empty the buffer", () => {
      // #given
      const buffer = filled(2, 1);

      // #when
      buffer.clear();

      // #then
      expect({ empty: buffer.isEmpty, latest: buffer.latest }).toEqual({
        empty: true,
        latest: undefined,
      });
    });
  });

  describe("forEach", () => {
    it("should visit samples oldest-first after wrapping", () => {
      // #given
      const buffer = new RingBuffer({ capacity: 3 });
      for (let i = 0; i < 4; i += 1) buffer.push(i, i);

      // #when
      const seen: number[] = [];
      buffer.forEach((_, v) => seen.push(v));

      // #then
      expect(seen).toEqual([1, 2, 3]);
    });
  });
});
