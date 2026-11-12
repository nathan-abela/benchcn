// benchcn.dev · signal-strength
// How many bars a signal reading lights, from RSSI in dBm or a 0 to 100 quality.

export type SignalUnit = "dBm" | "%";

/**
 * `MIN_RSSI` and `MAX_RSSI` from AOSP `WifiManager.java` (tag android-10.0.0_r1): at or below
 * -100 dBm shows no bars, at or above -55 dBm shows all of them.
 */
export const WIFI_RSSI_RANGE = { min: -100, max: -55 } as const;

/**
 * The reading each bar needs, lowest bar first. For dBm these reproduce AOSP
 * `calculateSignalLevel(rssi, bars + 1)`: bars split -100 to -55 dBm evenly. For a quality
 * percentage they are plain even steps (20, 40, 60, 80 for four bars), not from any standard.
 */
export function defaultSignalThresholds(unit: SignalUnit, bars: number): number[] {
  const count = Math.max(1, Math.round(bars));
  return Array.from({ length: count }, (_, i) => {
    const k = i + 1;
    if (unit === "%") return (k * 100) / (count + 1);
    return WIFI_RSSI_RANGE.min + (k * (WIFI_RSSI_RANGE.max - WIFI_RSSI_RANGE.min)) / count;
  });
}

/** Bars lit: one for every threshold the value reaches. */
export function signalBars(
  value: number | null | undefined,
  thresholds: readonly number[],
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  let lit = 0;
  for (const threshold of thresholds) if (value >= threshold) lit += 1;
  return lit;
}
