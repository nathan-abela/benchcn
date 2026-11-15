// benchcn.dev · emergency-stop
// A software stop that behaves like the physical button: it engages on the first touch with no
// hold or confirmation, latches, and says Stopped only once the device acknowledges. Resetting
// takes a second deliberate press and never restarts anything by itself. It is not a safety
// function; a real machine still needs a hardwired e-stop.
import {
  type ComponentProps,
  type KeyboardEvent,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
  useEffect,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { INSTRUMENT_FRAME, InstrumentLabel } from "@/registry/benchcn/lib/instrument";

export type EmergencyStopStatus =
  | "unknown"
  | "clear"
  | "stopping"
  | "engaged"
  | "resetting"
  | "unconfirmed";

export type EmergencyStopProps = Omit<ComponentProps<"div">, "onChange"> & {
  label?: ReactNode;
  description?: ReactNode;
  /** `true` once the user has pressed stop, `false` after a reset. */
  commanded: boolean | null;
  /** What the device last confirmed. `null` means unknown. */
  confirmed: boolean | null;
  pending?: boolean;
  error?: string | null;
  latency?: number | null;
  /** Time of the last change. Accepted so a tracked state can be spread in; not rendered. */
  updatedAt?: number;
  /** Called with `true` to engage and `false` to reset. */
  onCommand: (engaged: boolean) => void;
  /** Milliseconds the reset stays armed for its second press. */
  resetWindowMs?: number;
};

export function emergencyStopStatus(
  props: Pick<EmergencyStopProps, "commanded" | "confirmed" | "pending" | "error">,
): EmergencyStopStatus {
  if (props.pending) return props.commanded ? "stopping" : "resetting";
  if (props.error) return "unconfirmed";
  if (props.confirmed === null) return "unknown";
  return props.confirmed ? "engaged" : "clear";
}

const STATUS_TEXT: Record<EmergencyStopStatus, string> = {
  unknown: "Unknown",
  clear: "Clear",
  stopping: "Stopping",
  engaged: "Stopped",
  resetting: "Resetting",
  unconfirmed: "Not confirmed",
};

const STATUS_TONE: Record<EmergencyStopStatus, string> = {
  unknown: "text-muted-foreground",
  clear: "text-muted-foreground",
  stopping: "text-destructive",
  engaged: "text-destructive",
  resetting: "text-warning",
  unconfirmed: "text-destructive",
};

export function EmergencyStop({
  label = "Emergency stop",
  description,
  commanded,
  confirmed,
  pending = false,
  error = null,
  latency = null,
  updatedAt: _updatedAt,
  onCommand,
  resetWindowMs = 3000,
  className,
  children,
  ...props
}: EmergencyStopProps): ReactElement {
  const status = emergencyStopStatus({ commanded, confirmed, pending, error });
  const latched = commanded === true || confirmed === true;
  const [armedUntil, setArmedUntil] = useState<number | null>(null);
  const armed = armedUntil !== null;

  useEffect(() => {
    if (armedUntil === null) return;
    const timer = window.setTimeout(() => setArmedUntil(null), armedUntil - Date.now());
    return () => window.clearTimeout(timer);
  }, [armedUntil]);

  // Like the physical button, a confirmed stop stays down until reset. Until it is confirmed,
  // pressing again re-sends it, because the first command may have been lost.
  const held = confirmed === true && !pending;
  const engage = () => {
    if (held) return;
    setArmedUntil(null);
    onCommand(true);
  };
  // Pointer-down, not click: the stop must not wait for the finger to lift.
  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    engage();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    if (!event.repeat) engage();
  };
  const reset = () => {
    if (!armed) {
      setArmedUntil(Date.now() + resetWindowMs);
      return;
    }
    setArmedUntil(null);
    onCommand(false);
  };

  return (
    <div
      data-slot="emergency-stop"
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
        <span
          className={cn(
            "shrink-0 text-xs font-medium",
            STATUS_TONE[status],
            pending && "motion-safe:animate-pulse",
          )}
          aria-live="assertive"
        >
          {STATUS_TEXT[status]}
        </span>
      </div>

      <div className="flex flex-1 items-center justify-center py-2">
        {/* Every shadow is concentric: seen head-on, the button sits dead centre in its collar
            and shows being pressed by sinking inward, not by sliding down. */}
        <div className="rounded-full bg-[oklch(0.86_0.17_95)] p-3 shadow-[inset_0_0_0_2px_rgb(0_0_0/0.12),0_0_0_1px_rgb(0_0_0/0.15)]">
          <button
            type="button"
            aria-label="Emergency stop"
            aria-pressed={latched}
            aria-disabled={held || undefined}
            onPointerDown={onPointerDown}
            onKeyDown={onKeyDown}
            onContextMenu={(event) => event.preventDefault()}
            className={cn(
              "focus-visible:ring-ring/60 flex size-28 touch-manipulation items-center justify-center rounded-full bg-[oklch(0.56_0.22_27)] text-sm font-semibold tracking-wide text-white outline-none select-none focus-visible:ring-4",
              "shadow-[inset_0_0_0_3px_oklch(0.44_0.18_27),inset_0_0_14px_rgb(255_255_255/0.18),0_0_12px_rgb(0_0_0/0.35)]",
              "motion-safe:transition-[transform,box-shadow,background-color] motion-safe:duration-100",
              latched &&
                "scale-[0.93] bg-[oklch(0.5_0.2_27)] shadow-[inset_0_0_0_3px_oklch(0.4_0.17_27),inset_0_0_18px_rgb(0_0_0/0.45)]",
              held && "cursor-default",
            )}
          >
            STOP
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <InstrumentLabel className="tabular-nums">
          {error ? error : latency === null ? "--" : `Ack ${Math.round(latency)} ms`}
        </InstrumentLabel>
        <Button
          variant={armed ? "destructive" : "outline"}
          size="sm"
          disabled={!latched || pending}
          onClick={reset}
        >
          {armed ? "Confirm reset" : "Reset"}
        </Button>
      </div>
      {children}
    </div>
  );
}
