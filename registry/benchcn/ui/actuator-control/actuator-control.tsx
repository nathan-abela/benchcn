// benchcn.dev · actuator-control
// A press-and-hold control for relays, pumps and motor enables that never pretends: it shows
// what was commanded next to what the device confirmed, with latency, timeout and fail-safe.
import { motion, useReducedMotion as useMotionReducedMotion } from "motion/react";
import {
  type ComponentProps,
  type KeyboardEvent,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";
import { INSTRUMENT_FRAME, InstrumentLabel } from "@/registry/benchcn/lib/instrument";

export type ActuatorStatus = "unknown" | "idle" | "pending" | "confirmed" | "mismatch" | "error";

export type ActuatorControlProps = Omit<ComponentProps<"div">, "onChange"> & {
  label: ReactNode;
  description?: ReactNode;
  /** What the user last asked for. */
  commanded: boolean | null;
  /** What the device last confirmed. `null` means unknown. */
  confirmed: boolean | null;
  pending?: boolean;
  error?: string | null;
  /** Round trip of the last acknowledgement, in milliseconds. */
  latency?: number | null;
  onCommand: (next: boolean) => void;
  /** How long the button must be held before the command is sent. 0 makes it a plain tap. */
  holdMs?: number;
  disabled?: boolean;
  labels?: { on?: string; off?: string };
};

export function actuatorStatus(
  props: Pick<ActuatorControlProps, "commanded" | "confirmed" | "pending" | "error">,
): ActuatorStatus {
  if (props.pending) return "pending";
  if (props.error) return "error";
  if (props.confirmed === null) return "unknown";
  if (props.commanded !== null && props.commanded !== props.confirmed) return "mismatch";
  if (props.commanded === null) return "idle";
  return "confirmed";
}

const STATUS_TEXT: Record<ActuatorStatus, string> = {
  unknown: "Unknown",
  idle: "Idle",
  pending: "Waiting",
  confirmed: "Confirmed",
  mismatch: "Mismatch",
  error: "Error",
};

const STATUS_DOT: Record<ActuatorStatus, string> = {
  unknown: "bg-muted-foreground/40",
  idle: "bg-muted-foreground/60",
  pending: "bg-warning",
  confirmed: "bg-success",
  mismatch: "bg-warning",
  error: "bg-destructive",
};

type HoldOptions = {
  holdMs: number;
  disabled: boolean;
  onComplete: () => void;
};

function useHold({ holdMs, disabled, onComplete }: HoldOptions) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<number | null>(null);
  const completeRef = useRef(onComplete);

  useEffect(() => {
    completeRef.current = onComplete;
  }, [onComplete]);

  const cancel = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
  }, []);

  const begin = useCallback(() => {
    if (disabled || timer.current !== null) return;
    if (holdMs <= 0) {
      completeRef.current();
      return;
    }
    setHolding(true);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setHolding(false);
      completeRef.current();
    }, holdMs);
  }, [disabled, holdMs]);

  useEffect(() => cancel, [cancel]);

  return { holding, begin, cancel };
}

export function ActuatorControl({
  label,
  description,
  commanded,
  confirmed,
  pending = false,
  error = null,
  latency = null,
  onCommand,
  holdMs = 600,
  disabled = false,
  labels,
  className,
  children,
  ...props
}: ActuatorControlProps): ReactElement {
  const status = actuatorStatus({ commanded, confirmed, pending, error });
  const reduced = useMotionReducedMotion() ?? false;
  const next = !(commanded ?? confirmed ?? false);
  const onLabel = labels?.on ?? "On";
  const offLabel = labels?.off ?? "Off";
  const locked = disabled || pending;

  const { holding, begin, cancel } = useHold({
    holdMs,
    disabled: locked,
    onComplete: () => onCommand(next),
  });

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    if (!event.repeat) begin();
  };
  const onKeyUp = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === " " || event.key === "Enter") cancel();
  };
  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    begin();
  };

  const action = pending
    ? "Waiting for device"
    : holdMs > 0
      ? `Hold to turn ${next ? onLabel.toLowerCase() : offLabel.toLowerCase()}`
      : `Turn ${next ? onLabel.toLowerCase() : offLabel.toLowerCase()}`;

  return (
    <div
      data-slot="actuator-control"
      data-status={status}
      className={cn(INSTRUMENT_FRAME, "gap-4", className)}
      {...props}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-sm font-medium">{label}</span>
          {description ? (
            <span className="text-muted-foreground truncate text-xs">{description}</span>
          ) : null}
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 text-xs" aria-live="polite">
          <motion.span
            aria-hidden
            key={`${status}-${latency ?? 0}`}
            className={cn("size-1.5 rounded-full", STATUS_DOT[status])}
            animate={
              status === "pending" && !reduced
                ? { opacity: [1, 0.3, 1] }
                : status === "confirmed" && !reduced
                  ? { scale: [1, 1.8, 1] }
                  : { opacity: 1, scale: 1 }
            }
            transition={
              status === "pending"
                ? { duration: 1, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }
                : { duration: 0.35, ease: "easeOut" }
            }
          />
          {STATUS_TEXT[status]}
        </span>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={confirmed ?? "mixed"}
        aria-busy={pending}
        aria-disabled={locked || undefined}
        disabled={disabled}
        data-holding={holding}
        className={cn(
          "group bg-background relative isolate flex h-12 w-full touch-none items-center justify-between overflow-hidden rounded-lg border px-4 text-left text-sm select-none",
          "focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]",
          "shadow-[inset_0_1px_0_0_rgb(255_255_255/0.06),0_1px_2px_rgb(0_0_0/0.2)] active:shadow-[inset_0_2px_4px_rgb(0_0_0/0.35)]",
          "transition-[box-shadow,transform] duration-100 active:translate-y-px",
          locked && "cursor-not-allowed opacity-70",
          disabled && "opacity-50",
        )}
        onPointerDown={onPointerDown}
        onPointerUp={cancel}
        onPointerCancel={cancel}
        onPointerLeave={cancel}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onBlur={cancel}
        onContextMenu={(event) => event.preventDefault()}
      >
        <span
          aria-hidden
          className="bg-primary/15 absolute inset-y-0 left-0 -z-10 w-full origin-left transition-transform ease-linear"
          style={{
            transform: holding ? "scaleX(1)" : "scaleX(0)",
            transitionDuration: holding ? `${reduced ? 0 : holdMs}ms` : "150ms",
            transitionTimingFunction: holding ? "linear" : "ease-out",
          }}
        />
        <span className="font-medium">{action}</span>
        <span className="text-muted-foreground text-xs tabular-nums">
          {holding ? "Hold" : pending ? "…" : next ? onLabel : offLabel}
        </span>
      </button>

      <div className="@container">
        <dl className="grid grid-cols-3 gap-x-4 gap-y-3 text-sm font-medium tabular-nums @max-[300px]:grid-cols-2">
          <div className="flex flex-col gap-1">
            <dt>
              <InstrumentLabel>Commanded</InstrumentLabel>
            </dt>
            <dd>{commanded === null ? "--" : commanded ? onLabel : offLabel}</dd>
          </div>
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
              {confirmed === null ? "--" : confirmed ? onLabel : offLabel}
            </dd>
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
