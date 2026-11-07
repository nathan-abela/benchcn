// benchcn.dev · ring-buffer
// Fixed-capacity buffer of (time, value) pairs backed by typed arrays. Writes never allocate.

export type RingBufferOptions = {
  capacity: number;
  /** Float32Array halves memory for scope traces; Float64Array keeps full precision. */
  precision?: "f32" | "f64";
};

export class RingBuffer {
  readonly capacity: number;
  private readonly times: Float64Array;
  private readonly values: Float32Array | Float64Array;
  private head = 0;
  private count = 0;

  constructor({ capacity, precision = "f64" }: RingBufferOptions) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new RangeError(`capacity must be a positive integer, got ${capacity}`);
    }
    this.capacity = capacity;
    this.times = new Float64Array(capacity);
    this.values = precision === "f32" ? new Float32Array(capacity) : new Float64Array(capacity);
  }

  get length(): number {
    return this.count;
  }

  get isEmpty(): boolean {
    return this.count === 0;
  }

  push(time: number, value: number): void {
    this.times[this.head] = time;
    this.values[this.head] = value;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) this.count += 1;
  }

  /** Appends evenly spaced samples starting at `startTime` with `sampleRate` in Hz. */
  pushBlock(startTime: number, values: ArrayLike<number>, sampleRate: number): void {
    const dt = 1000 / sampleRate;
    for (let i = 0; i < values.length; i += 1) {
      this.push(startTime + i * dt, values[i]);
    }
  }

  clear(): void {
    this.head = 0;
    this.count = 0;
  }

  /** Oldest-first index into the logical sequence. */
  private physical(index: number): number {
    return (this.head - this.count + index + this.capacity) % this.capacity;
  }

  timeAt(index: number): number {
    return this.times[this.physical(index)];
  }

  valueAt(index: number): number {
    return this.values[this.physical(index)];
  }

  get latest(): { time: number; value: number } | undefined {
    if (this.count === 0) return undefined;
    const i = this.physical(this.count - 1);
    return { time: this.times[i], value: this.values[i] };
  }

  /** Copies the last `n` samples (or all of them) oldest-first. */
  tail(n = this.count): { times: Float64Array; values: Float64Array } {
    const take = Math.min(n, this.count);
    const times = new Float64Array(take);
    const values = new Float64Array(take);
    const start = this.count - take;
    for (let i = 0; i < take; i += 1) {
      const p = this.physical(start + i);
      times[i] = this.times[p];
      values[i] = this.values[p];
    }
    return { times, values };
  }

  /** Copies every sample with `time >= since`, oldest-first. Times are assumed monotonic. */
  since(since: number): { times: Float64Array; values: Float64Array } {
    let lo = 0;
    let hi = this.count;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.timeAt(mid) < since) lo = mid + 1;
      else hi = mid;
    }
    return this.tail(this.count - lo);
  }

  /** Visits samples oldest-first without copying. */
  forEach(fn: (time: number, value: number, index: number) => void): void {
    for (let i = 0; i < this.count; i += 1) {
      const p = this.physical(i);
      fn(this.times[p], this.values[p], i);
    }
  }

  /** Min and max over the last `n` samples, in one pass. */
  extent(n = this.count): { min: number; max: number } | undefined {
    const take = Math.min(n, this.count);
    if (take === 0) return undefined;
    let min = Infinity;
    let max = -Infinity;
    const start = this.count - take;
    for (let i = 0; i < take; i += 1) {
      const v = this.values[this.physical(start + i)];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    return { min, max };
  }
}
