// benchcn.dev · odometry-plot
// Records a robot's path from any source's pose channels for an odometry plot. A point is added
// only when the robot has moved, so standing still does not fill the buffer.
import { useEffect, useState, useSyncExternalStore } from "react";

import type { SourceSnapshot, SourceStore } from "@/registry/benchcn/lib/source-store";
import type {
  OdometryPoint,
  OdometryPose,
} from "@/registry/benchcn/ui/odometry-plot/odometry-plot";

export type UsePoseTrailOptions = {
  /** Channel ids for x, y (metres) and heading (degrees). */
  channels?: { x: string; y: string; heading: string };
  /** Smallest move, in metres, that adds a point. */
  minStep?: number;
  /** Points kept; the oldest are dropped first. */
  capacity?: number;
};

const DEFAULT_CHANNELS = { x: "pose-x", y: "pose-y", heading: "heading" };

function poseFrom(
  readings: SourceSnapshot["readings"],
  channels: { x: string; y: string; heading: string },
): OdometryPose | null {
  const x = readings[channels.x]?.v;
  const y = readings[channels.y]?.v;
  const heading = readings[channels.heading]?.v;
  if (typeof x !== "number" || typeof y !== "number") return null;
  return { x, y, heading: typeof heading === "number" ? heading : 0 };
}

export function usePoseTrail(
  source: { store: SourceStore },
  { channels = DEFAULT_CHANNELS, minStep = 0.01, capacity = 2000 }: UsePoseTrailOptions = {},
): { path: OdometryPoint[]; pose: OdometryPose | null; clear: () => void } {
  const { x, y, heading } = channels;
  const [path, setPath] = useState<OdometryPoint[]>([]);
  const readings = useSyncExternalStore(
    source.store.subscribe,
    () => source.store.getSnapshot().readings,
    () => source.store.getSnapshot().readings,
  );
  const pose = poseFrom(readings, { x, y, heading });

  useEffect(() => {
    const record = () => {
      const next = poseFrom(source.store.getSnapshot().readings, { x, y, heading });
      if (!next) return;
      setPath((current) => {
        const last = current[current.length - 1];
        if (last && Math.hypot(next.x - last.x, next.y - last.y) < minStep) return current;
        const grown = [...current, { x: next.x, y: next.y }];
        return grown.length > capacity ? grown.slice(grown.length - capacity) : grown;
      });
    };
    // x and y arrive as separate samples; recording on each one would draw a staircase, so wait a
    // frame and record once both of a tick's samples have landed.
    let frame = 0;
    const unsubscribe = source.store.subscribe(() => {
      if (frame === 0) {
        frame = requestAnimationFrame(() => {
          frame = 0;
          record();
        });
      }
    });
    return () => {
      unsubscribe();
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  }, [source.store, x, y, heading, minStep, capacity]);

  return { path, pose, clear: () => setPath([]) };
}
