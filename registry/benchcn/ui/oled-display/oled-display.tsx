// benchcn.dev · oled-display
// A monochrome OLED module drawn pixel for pixel from a one-bit bitmap or from raw SSD1306
// display RAM, so the buffer your firmware sends is the picture you see. Canvas 2D.
import {
  type ComponentProps,
  type CSSProperties,
  type ReactElement,
  useCallback,
  useMemo,
  useRef,
} from "react";

import { cn } from "@/lib/utils";
import { type CanvasFrame, useCanvas } from "@/registry/benchcn/hooks/use-canvas";
import { type Bitmap, createBitmap, fromSsd1306 } from "@/registry/benchcn/lib/bitmap";
import { resolveCssColor } from "@/registry/benchcn/lib/instrument";

export type OledColorPreset = "white" | "blue" | "amber" | "green" | "red" | "yellow-blue";

type SolidPreset = Exclude<OledColorPreset, "yellow-blue">;

export const OLED_COLORS: Record<SolidPreset | "yellow", string> = {
  white: "oklch(0.97 0.01 240)",
  blue: "oklch(0.78 0.14 230)",
  amber: "oklch(0.84 0.17 78)",
  green: "oklch(0.86 0.2 150)",
  red: "oklch(0.68 0.23 27)",
  yellow: "oklch(0.9 0.17 98)",
};

export type OledDisplayProps = Omit<ComponentProps<"div">, "color"> & {
  /** What to show. Pass a new bitmap when the picture changes. */
  bitmap?: Bitmap;
  /** Raw SSD1306 display RAM instead of a bitmap: one byte per column of each 8 pixel page. */
  buffer?: ArrayLike<number>;
  /** Panel size in pixels, used with `buffer` or when nothing is passed. */
  width?: number;
  height?: number;
  /**
   * Emitter colour: a preset or any CSS colour. `yellow-blue` is the common two-colour module
   * with a yellow top quarter.
   */
  color?: OledColorPreset | (string & {});
  /** CSS pixels per display pixel. The module shrinks to fit a narrower container. */
  scale?: number;
  /** Display on or off, like the SSD1306 display command. */
  on?: boolean;
  /** Swaps lit and unlit pixels. */
  invert?: boolean;
  /** Accessible description of what the screen shows. */
  label?: string;
};

const GLASS = "oklch(0.12 0.006 260)";
const PIXEL_GAP = 0.14;
const BLOOM = 0.4;

function rowColor(color: OledDisplayProps["color"], y: number, height: number): string {
  if (color === "yellow-blue") return y < height / 4 ? OLED_COLORS.yellow : OLED_COLORS.blue;
  if (color && color in OLED_COLORS) return OLED_COLORS[color as SolidPreset];
  return color ?? OLED_COLORS.white;
}

export function OledDisplay({
  bitmap,
  buffer,
  width = 128,
  height = 64,
  color = "white",
  scale = 2,
  on = true,
  invert = false,
  label = "OLED display",
  className,
  style,
  ...props
}: OledDisplayProps): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pixels = useMemo(
    () => bitmap ?? (buffer ? fromSsd1306(buffer, width, height) : createBitmap(width, height)),
    [bitmap, buffer, width, height],
  );

  const draw = useCallback(
    ({ ctx, width: boxWidth, height: boxHeight, dpr }: CanvasFrame) => {
      const styles = getComputedStyle(ctx.canvas);
      ctx.fillStyle = GLASS;
      ctx.fillRect(0, 0, boxWidth, boxHeight);
      if (!on) return;

      const cell = boxWidth / pixels.width;
      // Below three CSS pixels a gap would alias into stripes, so pixels touch instead.
      const gap = cell >= 3 ? cell * PIXEL_GAP : 0;
      const lit = invert ? 0 : 1;
      for (let y = 0; y < pixels.height; y += 1) {
        ctx.fillStyle = resolveCssColor(styles, rowColor(color, y, pixels.height));
        let runStart = -1;
        for (let x = 0; x <= pixels.width; x += 1) {
          const isLit = x < pixels.width && pixels.data[y * pixels.width + x] === lit;
          if (gap > 0) {
            if (isLit) ctx.fillRect(x * cell, y * cell, cell - gap, cell - gap);
          } else if (isLit && runStart < 0) {
            runStart = x;
          } else if (!isLit && runStart >= 0) {
            ctx.fillRect(runStart * cell, y * cell, (x - runStart) * cell, cell);
            runStart = -1;
          }
        }
      }

      // The emitters bloom a little into the glass. Browsers without canvas filters skip it.
      if ("filter" in ctx) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.filter = `blur(${cell * dpr * 0.9}px)`;
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = BLOOM;
        ctx.drawImage(ctx.canvas, 0, 0);
        ctx.restore();
      }
    },
    [pixels, color, on, invert],
  );

  useCanvas(canvasRef, { draw, running: false });

  const size: CSSProperties = {
    width: pixels.width * scale,
    aspectRatio: `${pixels.width} / ${pixels.height}`,
  };

  return (
    <div
      data-slot="oled-display"
      data-on={on}
      className={cn(
        // `dark` because the panel is dark in both themes: a theme colour must take its bright value.
        "dark inline-block max-w-full rounded-md bg-[oklch(0.17_0.008_260)] p-2 shadow-[inset_0_1px_0_rgb(255_255_255/0.08),0_1px_2px_rgb(0_0_0/0.4)]",
        className,
      )}
      style={style}
      {...props}
    >
      <canvas ref={canvasRef} aria-hidden className="block max-w-full rounded-[2px]" style={size} />
      <span className="sr-only">{label}</span>
    </div>
  );
}
