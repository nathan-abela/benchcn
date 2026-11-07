// benchcn.dev · status-led
// A panel LED: a physical colour, on or off, steady or blinking, with the lit state readable by
// assistive tech. Blinking is CSS so it costs nothing and stops under reduced motion.
import type { ComponentProps, CSSProperties, ReactElement, ReactNode } from "react";

import { cn } from "@/lib/utils";

export type LedColorPreset = "red" | "amber" | "green" | "blue" | "white";

export const LED_COLORS: Record<LedColorPreset, string> = {
  red: "oklch(0.66 0.24 28)",
  amber: "oklch(0.82 0.17 78)",
  green: "oklch(0.8 0.22 145)",
  blue: "oklch(0.7 0.18 255)",
  white: "oklch(0.97 0.01 90)",
};

export type LedPattern = "steady" | "blink" | "pulse" | "heartbeat";

export type StatusLedProps = Omit<ComponentProps<"span">, "color"> & {
  on?: boolean;
  /** A preset name or any CSS colour. Defaults to the theme's primary colour. */
  color?: LedColorPreset | (string & {});
  pattern?: LedPattern;
  /** Blink or pulse rate in hertz. */
  rate?: number;
  size?: "sm" | "md" | "lg";
  /** Accessible name; also shown next to the LED when `showLabel` is set. */
  label: ReactNode;
  showLabel?: boolean;
};

const SIZE: Record<NonNullable<StatusLedProps["size"]>, string> = {
  sm: "size-2",
  md: "size-3",
  lg: "size-4",
};

const PATTERN_CLASS: Record<LedPattern, string> = {
  steady: "",
  blink: "motion-safe:animate-[benchcn-blink_var(--led-period)_steps(1,end)_infinite]",
  pulse: "motion-safe:animate-[benchcn-pulse_var(--led-period)_ease-in-out_infinite]",
  heartbeat: "motion-safe:animate-[benchcn-heartbeat_var(--led-period)_ease-out_infinite]",
};

export function ledColor(color: StatusLedProps["color"]): string {
  if (!color) return "var(--primary)";
  return color in LED_COLORS ? LED_COLORS[color as LedColorPreset] : color;
}

export function StatusLed({
  on = true,
  color,
  pattern = "steady",
  rate = 2,
  size = "md",
  label,
  showLabel = false,
  className,
  style,
  ...props
}: StatusLedProps): ReactElement {
  const lit = ledColor(color);
  const ledStyle = {
    "--led": lit,
    "--led-period": `${1 / Math.max(0.1, rate)}s`,
  } as CSSProperties;

  return (
    <span
      data-slot="status-led"
      data-on={on}
      className={cn("inline-flex items-center gap-2 align-middle", className)}
      style={{ ...ledStyle, ...style }}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          "relative inline-block shrink-0 rounded-full transition-[background-color,box-shadow] duration-150",
          SIZE[size],
          on
            ? cn(
                "bg-[radial-gradient(circle_at_35%_35%,white_0,var(--led)_38%,color-mix(in_oklab,var(--led),black_25%)_100%)] shadow-[0_0_6px_1px_color-mix(in_oklab,var(--led),transparent_35%),inset_0_0_1px_rgb(255_255_255/0.6)]",
                PATTERN_CLASS[pattern],
              )
            : "bg-[color-mix(in_oklab,var(--led),black_72%)] shadow-[inset_0_1px_1px_rgb(0_0_0/0.5)]",
        )}
      />
      {showLabel ? (
        <span className="text-muted-foreground font-mono text-[11px] tracking-[0.08em] uppercase">
          {label}
        </span>
      ) : null}
      <span className="sr-only">
        {showLabel ? "" : label} {on ? (pattern === "steady" ? "on" : pattern) : "off"}
      </span>
    </span>
  );
}
