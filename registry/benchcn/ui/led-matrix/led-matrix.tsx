// benchcn.dev · led-matrix
// A dot-matrix LED panel, 8 rows by any number of chained 8 column modules. Shows a bitmap, or
// text in the 5x8 font that scrolls when it is wider than the panel.
import {
  type ComponentProps,
  type CSSProperties,
  type ReactElement,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";

import { cn } from "@/lib/utils";
import { type Bitmap, createBitmap, textBitmap, windowBitmap } from "@/registry/benchcn/lib/bitmap";
import { useReducedMotion } from "@/registry/benchcn/lib/instrument";
import { ledColor, type LedColorPreset } from "@/registry/benchcn/ui/status-led/status-led";

export type LedMatrixProps = Omit<ComponentProps<"div">, "color"> & {
  /** Text in the 5x8 font. Scrolls right to left when it is wider than the panel. */
  text?: string;
  /** Pixels to show instead of text. Pass a new bitmap when the picture changes. */
  bitmap?: Bitmap;
  /** Eight per chained module. */
  cols?: number;
  rows?: number;
  /** A preset name or any CSS colour. Defaults to the theme's primary colour. */
  color?: LedColorPreset | (string & {});
  shape?: "round" | "square";
  /** CSS pixels per LED. The panel shrinks to fit a narrower container. */
  size?: number;
  /** Scroll text that does not fit. Off, it is clipped at the right edge. */
  scroll?: boolean;
  /** Scroll speed in columns per second. */
  speed?: number;
  /** Accessible description. Defaults to the text. */
  label?: string;
};

const LED_RADIUS = 0.36;
const LED_SIDE = 0.76;

/** Counts scroll steps while `active`, and holds at zero otherwise. */
function useScrollStep(active: boolean, speed: number): number {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setStep((s) => s + 1), 1000 / Math.max(1, speed));
    return () => window.clearInterval(timer);
  }, [active, speed]);
  return active ? step : 0;
}

export function LedMatrix({
  text,
  bitmap,
  cols = 32,
  rows = 8,
  color,
  shape = "round",
  size = 8,
  scroll = true,
  speed = 14,
  label,
  className,
  style,
  ...props
}: LedMatrixProps): ReactElement {
  const id = useId();
  const reduced = useReducedMotion();
  const source = useMemo(
    () => bitmap ?? (text ? textBitmap(text) : createBitmap(cols, rows)),
    [bitmap, text, cols, rows],
  );
  const overflows = !bitmap && source.width > cols;
  const step = useScrollStep(overflows && scroll && !reduced, speed);

  const view = useMemo(() => {
    if (bitmap) return windowBitmap(source, 0, cols, rows);
    if (!overflows) return windowBitmap(source, -Math.floor((cols - source.width) / 2), cols, rows);
    // One lap: the text enters from the right edge and leaves by the left.
    const lap = source.width + cols;
    const offset = scroll && !reduced ? (step % lap) - cols : 0;
    return windowBitmap(source, offset, cols, rows);
  }, [bitmap, source, overflows, scroll, reduced, step, cols, rows]);

  const lit: { x: number; y: number }[] = [];
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) if (view.data[y * cols + x]) lit.push({ x, y });
  }

  const dot = (x: number, y: number, fill: string, key?: string): ReactElement =>
    shape === "round" ? (
      <circle key={key} cx={x + 0.5} cy={y + 0.5} r={LED_RADIUS} fill={fill} />
    ) : (
      <rect
        key={key}
        x={x + (1 - LED_SIDE) / 2}
        y={y + (1 - LED_SIDE) / 2}
        width={LED_SIDE}
        height={LED_SIDE}
        rx={0.1}
        fill={fill}
      />
    );

  return (
    <div
      data-slot="led-matrix"
      className={cn(
        "inline-block max-w-full rounded-md bg-[oklch(0.16_0.005_260)] p-1.5 shadow-[inset_0_1px_0_rgb(255_255_255/0.08),0_1px_2px_rgb(0_0_0/0.4)]",
        className,
      )}
      style={{ "--led": ledColor(color), ...style } as CSSProperties}
      {...props}
    >
      <svg
        width={cols * size}
        height={rows * size}
        viewBox={`0 0 ${cols} ${rows}`}
        aria-hidden
        className="block h-auto max-w-full"
      >
        <defs>
          <pattern id={id} width={1} height={1} patternUnits="userSpaceOnUse">
            {dot(0, 0, "color-mix(in oklab, var(--led), oklch(0.2 0.005 260) 86%)")}
          </pattern>
        </defs>
        <rect width={cols} height={rows} fill={`url(#${id})`} />
        <g style={{ filter: "drop-shadow(0 0 0.35px var(--led))" }}>
          {lit.map((p) => dot(p.x, p.y, "var(--led)", `${p.x}-${p.y}`))}
        </g>
      </svg>
      <span className="sr-only">{label ?? text ?? "LED matrix"}</span>
    </div>
  );
}
