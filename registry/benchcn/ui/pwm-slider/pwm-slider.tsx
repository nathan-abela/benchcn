// benchcn.dev · pwm-slider
// Continuous control for a PWM output: LED dimming, a servo angle, motor duty. While the thumb
// moves, values stream at a limited rate through `onChange`; the value it is released on goes out
// once through `onCommand` and is tracked like a setpoint, so where the drag ended gets confirmed.
import {
  type ComponentProps,
  type ReactElement,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { INSTRUMENT_FRAME, InstrumentLabel } from "@/registry/benchcn/lib/instrument";
import { createRateLimiter, type RateLimiter } from "@/registry/benchcn/lib/pacing";
import { decimalsOf, fractionOf } from "@/registry/benchcn/lib/stepper";

export type PwmSliderStatus =
  | "unknown"
  | "idle"
  | "streaming"
  | "pending"
  | "confirmed"
  | "mismatch"
  | "error";

export type PwmSliderProps = Omit<ComponentProps<"div">, "onChange"> & {
  label: ReactNode;
  description?: ReactNode;
  /** Duty in percent by default; any unit works with `min` and `max`, such as degrees. */
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  /** Decimal places. Defaults to the decimals of `step`. */
  precision?: number;
  /** What the user last asked for. */
  commanded: number | null;
  /** What the device last confirmed. `null` means unknown. */
  confirmed: number | null;
  pending?: boolean;
  error?: string | null;
  /** Round trip of the last acknowledgement, in milliseconds. */
  latency?: number | null;
  /** Time of the last change. Accepted so a tracked state can be spread in, not rendered. */
  updatedAt?: number;
  /** Called at most `rate` times a second while dragging. Send with `send`, untracked. */
  onChange?: (value: number) => void;
  /** Called once with the value the drag or key press ended on. */
  onCommand: (value: number) => void;
  /** Streamed values per second while dragging. */
  rate?: number;
  disabled?: boolean;
};

export function pwmSliderStatus(
  props: Pick<PwmSliderProps, "commanded" | "confirmed" | "pending" | "error">,
  dragging: boolean,
  tolerance: number,
): PwmSliderStatus {
  if (dragging) return "streaming";
  if (props.pending) return "pending";
  if (props.error) return "error";
  if (props.confirmed === null) return "unknown";
  if (props.commanded === null) return "idle";
  if (Math.abs(props.commanded - props.confirmed) > tolerance) return "mismatch";
  return "confirmed";
}

const STATUS_TEXT: Record<PwmSliderStatus, string> = {
  unknown: "Unknown",
  idle: "Idle",
  streaming: "Streaming",
  pending: "Waiting",
  confirmed: "Confirmed",
  mismatch: "Mismatch",
  error: "Error",
};

const STATUS_DOT: Record<PwmSliderStatus, string> = {
  unknown: "bg-muted-foreground/40",
  idle: "bg-muted-foreground/60",
  streaming: "bg-primary",
  pending: "bg-warning motion-safe:animate-pulse",
  confirmed: "bg-success",
  mismatch: "bg-warning",
  error: "bg-destructive",
};

const MARK_TONE: Partial<Record<PwmSliderStatus, string>> = {
  confirmed: "bg-success",
  mismatch: "bg-warning",
  error: "bg-destructive",
};

/** Half the thumb width: Base UI keeps the thumb inside the track with `thumbAlignment="edge"`. */
const THUMB_RADIUS = 10;

const first = (value: number | readonly number[]): number =>
  typeof value === "number" ? value : value[0];

export function PwmSlider({
  label,
  description,
  unit = "%",
  min = 0,
  max = 100,
  step = 1,
  precision,
  commanded,
  confirmed,
  pending = false,
  error = null,
  latency = null,
  updatedAt: _updatedAt,
  onChange,
  onCommand,
  rate = 20,
  disabled = false,
  className,
  children,
  ...props
}: PwmSliderProps): ReactElement {
  const id = useId();
  const digits = precision ?? decimalsOf(step);
  const format = (n: number) => n.toFixed(digits);
  const withUnit = (n: number) => `${format(n)}${unit === "%" || unit === "°" ? "" : " "}${unit}`;

  const [draft, setDraft] = useState<number | null>(null);
  const changeRef = useRef(onChange);

  useEffect(() => {
    changeRef.current = onChange;
  }, [onChange]);

  const limiter = useRef<RateLimiter<number> | null>(null);
  useEffect(() => {
    const created = createRateLimiter((value: number) => changeRef.current?.(value), 1000 / rate);
    limiter.current = created;
    return () => created.cancel();
  }, [rate]);

  const status = pwmSliderStatus(
    { commanded, confirmed, pending, error },
    draft !== null,
    step / 2,
  );
  const shown = draft ?? commanded ?? confirmed;

  return (
    <div
      data-slot="pwm-slider"
      data-status={status}
      className={cn(INSTRUMENT_FRAME, "gap-4", disabled && "opacity-60", className)}
      {...props}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span id={`${id}-label`} className="truncate text-sm font-medium">
            {label}
            <span className="sr-only">, {unit}</span>
          </span>
          {description ? (
            <span className="text-muted-foreground truncate text-xs">{description}</span>
          ) : null}
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 text-xs" aria-live="polite">
          <span aria-hidden className={cn("size-1.5 rounded-full", STATUS_DOT[status])} />
          {STATUS_TEXT[status]}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <span aria-hidden className="text-2xl leading-none font-medium tabular-nums">
          {shown === null ? "--" : format(shown)}
          <span className="text-muted-foreground ml-1 text-sm">{unit}</span>
        </span>
        <div className="relative">
          {confirmed === null ? null : (
            <span
              aria-hidden
              className={cn(
                "pointer-events-none absolute top-1/2 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full",
                MARK_TONE[status] ?? "bg-muted-foreground",
              )}
              style={{
                left: `calc(${THUMB_RADIUS}px + (100% - ${THUMB_RADIUS * 2}px) * ${fractionOf(confirmed, min, max)})`,
              }}
            />
          )}
          <Slider
            aria-labelledby={`${id}-label`}
            value={[shown ?? min]}
            min={min}
            max={max}
            step={step}
            disabled={disabled}
            className="touch-manipulation py-2 [&_[data-slot=slider-thumb]]:size-5 [&_[data-slot=slider-track]]:h-2!"
            onValueChange={(value, details) => {
              const next = first(value);
              setDraft(next);
              if (details.reason === "drag" || details.reason === "track-press")
                limiter.current?.push(next);
            }}
            onValueCommitted={(value) => {
              limiter.current?.cancel();
              setDraft(null);
              onCommand(first(value));
            }}
          />
        </div>
        <div
          aria-hidden
          className="text-muted-foreground flex justify-between text-xs tabular-nums"
        >
          <span>{withUnit(min)}</span>
          <span>{withUnit(max)}</span>
        </div>
      </div>

      <div className="@container">
        <dl className="grid grid-cols-3 gap-x-4 gap-y-3 text-sm font-medium tabular-nums @max-[300px]:grid-cols-2">
          <div className="flex flex-col gap-1">
            <dt>
              <InstrumentLabel>Confirmed</InstrumentLabel>
            </dt>
            <dd
              className={cn(
                status === "mismatch" && "text-warning",
                status === "error" && "text-destructive",
                status === "confirmed" && "text-success",
              )}
            >
              {confirmed === null ? "--" : withUnit(confirmed)}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt>
              <InstrumentLabel>Commanded</InstrumentLabel>
            </dt>
            <dd>{commanded === null ? "--" : withUnit(commanded)}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt>
              <InstrumentLabel>{error ? "Error" : "Latency"}</InstrumentLabel>
            </dt>
            <dd className={cn(error && "text-destructive")}>
              {error ? error : latency === null ? "--" : `${Math.round(latency)} ms`}
            </dd>
          </div>
        </dl>
      </div>
      {children}
    </div>
  );
}
