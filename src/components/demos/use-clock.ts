import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void): () => void {
  const timer = window.setInterval(onChange, 1000);
  return () => window.clearInterval(timer);
}

function readSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export type Clock = { time: string; colon: boolean };

/** Wall-clock HH:MM with a colon that blinks each second; `--:--` in the prerendered HTML so hydration matches. */
export function useClock(): Clock {
  const seconds = useSyncExternalStore(subscribe, readSeconds, () => null);
  if (seconds === null) return { time: "--:--", colon: true };
  const now = new Date(seconds * 1000);
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return { time: `${hh}:${mm}`, colon: seconds % 2 === 0 };
}
