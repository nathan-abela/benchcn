// benchcn.dev · led-bar
// A segmented LED bar graph, the kind an LM3914 drives: bar or dot mode, with warning and alarm
// segments in fixed colours like the amber and red LEDs at the end of a real bar.
import type { ComponentProps, CSSProperties, ReactElement } from "react";

import { cn } from "@/lib/utils";
import {
  isSegmentLit,
  type LedBarMode,
  type LedBarThresholds,
  segmentsReached,
  segmentTone,
  type SegmentTone,
} from "@/registry/benchcn/lib/led-segments";
import {
  LED_COLORS,
  ledColor,
  type LedColorPreset,
} from "@/registry/benchcn/ui/status-led/status-led";

export type LedBarProps = Omit<ComponentProps<"div">, "color"> & {
  /** `null` leaves every segment dark. */
  value: number | null | undefined;
  min?: number;
  max?: number;
  segments?: number;
  /** `bar` fills up to the value, `dot` lights only the segment it reaches. */
  mode?: LedBarMode;
  /** Segments past these limits are amber (warning) or red (alarm), lit or not. */
  thresholds?: LedBarThresholds;
  /** Colour of the normal segments: a preset or any CSS colour. Defaults to the theme's primary colour. */
  color?: LedColorPreset | (string & {});
  orientation?: "horizontal" | "vertical";
  /** Accessible name. */
  label: string;
  unit?: string;
};

function toneColor(tone: SegmentTone, color: LedBarProps["color"]): string {
  if (tone === "alarm") return LED_COLORS.red;
  if (tone === "warn") return LED_COLORS.amber;
  return ledColor(color);
}

export function LedBar({
  value,
  min = 0,
  max = 100,
  segments = 10,
  mode = "bar",
  thresholds,
  color,
  orientation = "horizontal",
  label,
  unit,
  className,
  ...props
}: LedBarProps): ReactElement {
  const vertical = orientation === "vertical";
  const hasValue = typeof value === "number" && Number.isFinite(value);
  const reached = segmentsReached(value, min, max, segments);

  return (
    <div
      data-slot="led-bar"
      data-orientation={orientation}
      className={cn(
        // `dark` because the panel is dark in both themes: `--primary` must take its bright value.
        "dark inline-flex max-w-full gap-[3px] rounded-md bg-[oklch(0.16_0.005_260)] p-1.5 shadow-[inset_0_1px_0_rgb(255_255_255/0.08),0_1px_2px_rgb(0_0_0/0.4)]",
        vertical && "flex-col-reverse",
        className,
      )}
      {...props}
    >
      <meter
        className="sr-only"
        aria-label={label}
        aria-valuetext={hasValue ? `${value}${unit ? ` ${unit}` : ""}` : "no reading"}
        min={min}
        max={max}
        value={hasValue ? value : undefined}
      />
      {Array.from({ length: segments }, (_, index) => {
        const lit = isSegmentLit(index, reached, mode);
        return (
          <span
            // Segments never reorder, and their position is their identity.
            // oxlint-disable-next-line react/no-array-index-key
            key={index}
            aria-hidden
            data-lit={lit}
            className={cn(
              "rounded-[2px] transition-[background-color,box-shadow] duration-100",
              vertical ? "h-2 w-6" : "h-6 w-2 min-w-0 shrink",
              lit
                ? "bg-[linear-gradient(to_bottom,color-mix(in_oklab,var(--led),white_30%),var(--led))] shadow-[0_0_6px_color-mix(in_oklab,var(--led),transparent_45%)]"
                : "bg-[color-mix(in_oklab,var(--led),oklch(0.2_0.005_260)_84%)]",
            )}
            style={
              {
                "--led": toneColor(segmentTone(index, min, max, segments, thresholds), color),
              } as CSSProperties
            }
          />
        );
      })}
    </div>
  );
}
