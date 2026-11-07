// benchcn.dev · use-ring-buffer
// Collects one channel's samples and blocks from a source into a ring buffer that scopes and
// strip charts can read every frame without going through React state.
import { useEffect, useRef, useState } from "react";

import { RingBuffer } from "@/registry/benchcn/lib/ring-buffer";
import type { SourceStore } from "@/registry/benchcn/lib/source-store";
import { createClockMapper, isSample } from "@/registry/benchcn/lib/wire";

export type UseRingBufferOptions = {
  capacity?: number;
  precision?: "f32" | "f64";
};

export type RingBufferHandle = {
  buffer: RingBuffer;
  /** Samples per second of the last block, or an estimate from sample spacing. */
  sampleRate: number;
  /** Bumps at most once per animation frame when data arrives. */
  revision: number;
};

export function useRingBuffer(
  store: Pick<SourceStore, "onBlock" | "subscribe" | "getSnapshot"> | null,
  channel: string,
  { capacity = 65_536, precision = "f32" }: UseRingBufferOptions = {},
): RingBufferHandle {
  const [buffer] = useState(() => new RingBuffer({ capacity, precision }));
  const [revision, setRevision] = useState(0);
  const [sampleRate, setSampleRate] = useState(0);
  const rate = useRef(0);
  const pending = useRef(0);

  useEffect(() => {
    if (!store) return;
    const clock = createClockMapper(() => Date.now());
    let lastSampleTime: number | null = null;
    const bump = () => {
      if (pending.current) return;
      pending.current = requestAnimationFrame(() => {
        pending.current = 0;
        setRevision((r) => r + 1);
        setSampleRate(rate.current);
      });
    };

    const offBlock = store.onBlock((block) => {
      if (block.ch !== channel) return;
      rate.current = block.sr;
      buffer.pushBlock(clock(block.t), block.vs, block.sr);
      bump();
    });

    let seen = store.getSnapshot().received;
    const offSample = store.subscribe(() => {
      const snapshot = store.getSnapshot();
      if (snapshot.received === seen) return;
      seen = snapshot.received;
      const sample = snapshot.readings[channel];
      if (!sample || !isSample(sample) || typeof sample.v !== "number") return;
      const time = clock(sample.t);
      if (time === lastSampleTime) return;
      if (lastSampleTime !== null && time > lastSampleTime) {
        rate.current = 1000 / (time - lastSampleTime);
      }
      lastSampleTime = time;
      buffer.push(time, sample.v);
      bump();
    });

    return () => {
      offBlock();
      offSample();
      if (pending.current) cancelAnimationFrame(pending.current);
    };
  }, [store, channel, buffer]);

  return { buffer, sampleRate, revision };
}
