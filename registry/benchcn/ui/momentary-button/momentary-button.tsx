// benchcn.dev · momentary-button
// Hold to run: the output is on only while the button is held, for a jog, a horn or priming a
// pump. On goes out at press and off on every way a hold can end (release, cancel, focus leaving,
// the window or tab going away), and the device's own report shows whether it really stopped.
import {
  type ComponentProps,
  type KeyboardEvent,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";
import { INSTRUMENT_FRAME, InstrumentLabel } from "@/registry/benchcn/lib/instrument";

export type MomentaryStatus = "unknown" | "off" | "pending" | "on" | "stuck" | "mismatch" | "error";

export type MomentaryButtonProps = Omit<ComponentProps<"div">, "onChange"> & {
  label: ReactNode;
  description?: ReactNode;
  /** What the user last asked for: `true` while held. */
  commanded: boolean | null;
  /** What the device last confirmed. `null` means unknown. */
  confirmed: boolean | null;
  pending?: boolean;
  error?: string | null;
  /** Round trip of the last acknowledgement, in milliseconds. */
  latency?: number | null;
  /** Time of the last change. Accepted so a tracked state can be spread in, not rendered. */
  updatedAt?: number;
  /** Called with `true` at press and `false` when the hold ends, however it ends. */
  onCommand: (on: boolean) => void;
  /** Button text while released. */
  action?: string;
  disabled?: boolean;
  labels?: { on?: string; off?: string };
};

export function momentaryStatus(
  props: Pick<MomentaryButtonProps, "commanded" | "confirmed" | "pending" | "error">,
): MomentaryStatus {
  if (props.pending) return "pending";
  // Still on after the release is the state that matters most, even when the off timed out.
  if (props.confirmed === true && props.commanded !== true) return "stuck";
  if (props.error) return "error";
  if (props.confirmed === null) return "unknown";
  if (props.confirmed === false && props.commanded === true) return "mismatch";
  return props.confirmed ? "on" : "off";
}

const STATUS_TEXT: Record<MomentaryStatus, string> = {
  unknown: "Unknown",
  off: "Off",
  pending: "Waiting",
  on: "On",
  stuck: "Still on",
  mismatch: "Not on",
  error: "Error",
};

const STATUS_DOT: Record<MomentaryStatus, string> = {
  unknown: "bg-muted-foreground/40",
  off: "bg-muted-foreground/60",
  pending: "bg-warning motion-safe:animate-pulse",
  on: "bg-success",
  stuck: "bg-destructive",
  mismatch: "bg-warning",
  error: "bg-destructive",
};

export function MomentaryButton({
  label,
  description,
  commanded,
  confirmed,
  pending = false,
  error = null,
  latency = null,
  updatedAt: _updatedAt,
  onCommand,
  action = "Hold to run",
  disabled = false,
  labels,
  className,
  children,
  ...props
}: MomentaryButtonProps): ReactElement {
  const status = momentaryStatus({ commanded, confirmed, pending, error });
  const onLabel = labels?.on ?? "On";
  const offLabel = labels?.off ?? "Off";
  const [holding, setHolding] = useState(false);
  const held = useRef(false);
  const commandRef = useRef(onCommand);

  useEffect(() => {
    commandRef.current = onCommand;
  }, [onCommand]);

  const start = () => {
    if (disabled || held.current) return;
    held.current = true;
    setHolding(true);
    commandRef.current(true);
  };
  const stop = () => {
    if (!held.current) return;
    held.current = false;
    setHolding(false);
    commandRef.current(false);
  };
  const stopRef = useRef(stop);

  useEffect(() => {
    stopRef.current = stop;
  });

  // A release the page never sees must still end the hold: switching windows or tabs swallows
  // the pointer-up and key-up, and unmounting mid-hold has no release at all.
  useEffect(() => {
    const end = () => stopRef.current();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") end();
    };
    window.addEventListener("blur", end);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", end);
      document.removeEventListener("visibilitychange", onVisibility);
      end();
    };
  }, []);

  useEffect(() => {
    if (disabled) stopRef.current();
  }, [disabled]);

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    start();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    if (!event.repeat) start();
  };
  const onKeyUp = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === " " || event.key === "Enter") stop();
  };

  return (
    <div
      data-slot="momentary-button"
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
          <span aria-hidden className={cn("size-1.5 rounded-full", STATUS_DOT[status])} />
          {STATUS_TEXT[status]}
        </span>
      </div>

      <button
        type="button"
        aria-pressed={holding}
        disabled={disabled}
        data-holding={holding || undefined}
        className={cn(
          "bg-background flex h-14 w-full touch-manipulation items-center justify-center rounded-lg border px-4 text-sm font-medium select-none",
          "focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]",
          "shadow-[inset_0_1px_0_0_rgb(255_255_255/0.06),0_1px_2px_rgb(0_0_0/0.2)]",
          "transition-[background-color,color,box-shadow] duration-100",
          holding &&
            "bg-primary text-primary-foreground border-primary shadow-[inset_0_2px_4px_rgb(0_0_0/0.35)]",
          disabled && "cursor-not-allowed opacity-50",
        )}
        onPointerDown={onPointerDown}
        onPointerUp={stop}
        onPointerCancel={stop}
        onPointerLeave={stop}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onBlur={stop}
        onContextMenu={(event) => event.preventDefault()}
      >
        {holding ? "Release to stop" : action}
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
                status === "stuck" && "text-destructive",
                status === "mismatch" && "text-warning",
                status === "on" && "text-success",
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
