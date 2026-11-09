// benchcn.dev · strip-chart
// Records numeric channels from any source as timestamped points for a strip chart. Points are
// stamped on arrival, so a device with a drifting clock still scrolls in step with the page.
import { useEffect, useState, useSyncExternalStore } from "react";

import type { SourceStore } from "@/registry/benchcn/lib/source-store";
import type { StripPoint } from "@/registry/benchcn/lib/strip-math";
import type { WireSample } from "@/registry/benchcn/lib/wire";

export type StripSeries = {
  id: string;
  label?: string;
  unit?: string;
  /** Any CSS colour. Defaults to `--channel-n` by position. */
  color?: string;
  /** Fixed range for this series in a stacked chart. */
  min?: number;
  max?: number;
  /** Oldest first. */
  points: ArrayLike<StripPoint>;
};

export type UseStripSeriesOptions = {
  /** Points kept per channel. At one sample a second the default holds an hour. */
  capacity?: number;
};

type Buffers = Map<string, { points: StripPoint[]; last: WireSample | undefined }>;

export function useStripSeries(
  source: { store: SourceStore },
  channels: string[],
  { capacity = 3600 }: UseStripSeriesOptions = {},
): StripSeries[] {
  const key = channels.join("\u0000");
  const [buffers] = useState<Buffers>(() => new Map());
  const [, setVersion] = useState(0);

  useEffect(() => {
    const ids = key.split("\u0000").filter(Boolean);
    for (const id of ids) if (!buffers.has(id)) buffers.set(id, { points: [], last: undefined });
    let frame = 0;

    const record = () => {
      const { readings } = source.store.getSnapshot();
      const now = Date.now();
      let changed = false;
      for (const id of ids) {
        const reading = readings[id];
        const buffer = buffers.get(id);
        if (!buffer || !reading || reading === buffer.last) continue;
        buffer.last = reading;
        if (typeof reading.v !== "number") continue;
        buffer.points.push({ t: now, v: reading.v });
        // Trimming in batches keeps the push cheap at high sample rates.
        if (buffer.points.length > capacity * 1.1)
          buffer.points.splice(0, buffer.points.length - capacity);
        changed = true;
      }
      if (changed && frame === 0) {
        frame = requestAnimationFrame(() => {
          frame = 0;
          setVersion((n) => n + 1);
        });
      }
    };

    record();
    const unsubscribe = source.store.subscribe(record);
    return () => {
      unsubscribe();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [source.store, key, buffers, capacity]);

  const hello = useSyncExternalStore(
    source.store.subscribe,
    () => source.store.getSnapshot().hello,
    () => source.store.getSnapshot().hello,
  );

  return key
    .split("\u0000")
    .filter(Boolean)
    .map((id) => {
      const info = hello?.chs?.find((c) => c.id === id);
      const buffer = buffers.get(id);
      return {
        id,
        label: info?.label ?? id,
        unit: buffer?.last?.u ?? info?.u,
        points: buffer?.points ?? [],
      };
    });
}
