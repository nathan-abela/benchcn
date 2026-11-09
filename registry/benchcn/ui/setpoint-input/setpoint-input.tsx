// benchcn.dev · setpoint-input
// A numeric setpoint that never pretends: edits stay a draft until applied, out-of-range values
// never leave the page, large changes can ask twice, and the device's acknowledged value is shown
// next to what was asked for, so a clamped or dropped command is visible.
import {
  type ChangeEvent,
  type ComponentProps,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  useId,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { INSTRUMENT_FRAME, InstrumentLabel } from "@/registry/benchcn/lib/instrument";

export type SetpointStatus = "unknown" | "idle" | "pending" | "confirmed" | "mismatch" | "error";

export type SetpointInputProps = Omit<ComponentProps<"div">, "onChange"> & {
  label: ReactNode;
  description?: ReactNode;
  unit?: string;
  min: number;
  max: number;
  /** Arrow keys and the buttons move by `step`; Shift or Page Up/Down by ten steps. */
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
  /** The measured value the setpoint drives, such as the temperature a heater controls. */
  value?: number | null;
  onCommand: (next: number) => void;
  /** Ask for a second press before sending: always with `true`, or for changes larger than this. */
  confirm?: boolean | number;
  disabled?: boolean;
};

export function setpointStatus(
  props: Pick<SetpointInputProps, "commanded" | "confirmed" | "pending" | "error">,
  tolerance: number,
): SetpointStatus {
  if (props.pending) return "pending";
  if (props.error) return "error";
  if (props.confirmed === null) return "unknown";
  if (props.commanded === null) return "idle";
  if (Math.abs(props.commanded - props.confirmed) > tolerance) return "mismatch";
  return "confirmed";
}

/** Parses a draft and says why it cannot be sent, if it cannot. */
export function validateSetpoint(
  text: string,
  min: number,
  max: number,
  unit = "",
): { value: number | null; problem: string | null } {
  const value = Number(text.trim().replace(",", "."));
  if (text.trim() === "" || !Number.isFinite(value))
    return { value: null, problem: "Enter a number" };
  const suffix = unit ? ` ${unit}` : "";
  if (value < min) return { value, problem: `Min ${min}${suffix}` };
  if (value > max) return { value, problem: `Max ${max}${suffix}` };
  return { value, problem: null };
}

const STATUS_TEXT: Record<SetpointStatus, string> = {
  unknown: "Unknown",
  idle: "Idle",
  pending: "Waiting",
  confirmed: "Confirmed",
  mismatch: "Mismatch",
  error: "Error",
};

const STATUS_DOT: Record<SetpointStatus, string> = {
  unknown: "bg-muted-foreground/40",
  idle: "bg-muted-foreground/60",
  pending: "bg-warning motion-safe:animate-pulse",
  confirmed: "bg-success",
  mismatch: "bg-warning",
  error: "bg-destructive",
};

function decimalsOf(step: number): number {
  const text = String(step);
  return text.includes(".") ? text.split(".")[1].length : 0;
}

export function SetpointInput({
  label,
  description,
  unit,
  min,
  max,
  step = 1,
  precision,
  commanded,
  confirmed,
  pending = false,
  error = null,
  latency = null,
  updatedAt: _updatedAt,
  value,
  onCommand,
  confirm = false,
  disabled = false,
  className,
  children,
  ...props
}: SetpointInputProps): ReactElement {
  const id = useId();
  const digits = precision ?? decimalsOf(step);
  const format = (n: number) => n.toFixed(digits);
  const status = setpointStatus({ commanded, confirmed, pending, error }, step / 2);

  // `draft` is null while the field simply follows the device.
  const [draft, setDraft] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);
  const current = commanded ?? confirmed;
  const text = draft ?? (current === null ? "" : format(current));
  const { value: parsed, problem } = validateSetpoint(text, min, max, unit);
  const dirty = draft !== null && parsed !== null && (current === null || parsed !== current);
  const locked = disabled || pending;
  const needsConfirm =
    confirm === true ||
    (typeof confirm === "number" &&
      parsed !== null &&
      current !== null &&
      Math.abs(parsed - current) > confirm);

  const edit = (next: string) => {
    setDraft(next);
    setArmed(false);
  };
  const nudge = (direction: 1 | -1, big: boolean) => {
    const base = parsed ?? current ?? min;
    const next = Math.min(max, Math.max(min, base + direction * step * (big ? 10 : 1)));
    edit(format(Math.round(next / step) * step));
  };
  const revert = () => {
    setDraft(null);
    setArmed(false);
  };
  const apply = () => {
    if (locked || !dirty || problem !== null || parsed === null) return;
    if (needsConfirm && !armed) {
      setArmed(true);
      return;
    }
    onCommand(parsed);
    revert();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const keys: Record<string, () => void> = {
      ArrowUp: () => nudge(1, event.shiftKey),
      ArrowDown: () => nudge(-1, event.shiftKey),
      PageUp: () => nudge(1, true),
      PageDown: () => nudge(-1, true),
      Enter: apply,
      Escape: revert,
    };
    const action = keys[event.key];
    if (!action || locked) return;
    event.preventDefault();
    action();
  };

  const confirmedTone = cn(
    status === "mismatch" && "text-warning",
    status === "error" && "text-destructive",
    status === "confirmed" && "text-success",
  );

  return (
    <div
      data-slot="setpoint-input"
      data-status={status}
      className={cn(INSTRUMENT_FRAME, "gap-4", className)}
      {...props}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor={id} className="truncate text-sm font-medium">
            {label}
          </label>
          {description ? (
            <span className="text-muted-foreground truncate text-xs">{description}</span>
          ) : null}
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 text-xs" aria-live="polite">
          <span aria-hidden className={cn("size-1.5 rounded-full", STATUS_DOT[status])} />
          {STATUS_TEXT[status]}
        </span>
      </div>

      <div className="@container flex flex-col gap-1.5">
        <div className="flex flex-col gap-2 @[19rem]:flex-row @[19rem]:items-stretch">
          <div
            className={cn(
              "bg-background focus-within:ring-ring/50 flex h-12 min-w-0 flex-1 items-center rounded-lg border focus-within:ring-[3px]",
              problem !== null && draft !== null && "border-destructive",
              locked && "opacity-60",
            )}
          >
            <button
              type="button"
              tabIndex={-1}
              aria-label="Decrease"
              disabled={locked}
              className="text-muted-foreground hover:text-foreground h-full touch-manipulation px-3.5 text-lg select-none disabled:pointer-events-none"
              onClick={() => nudge(-1, false)}
            >
              −
            </button>
            <input
              id={id}
              role="spinbutton"
              inputMode="decimal"
              autoComplete="off"
              aria-valuemin={min}
              aria-valuemax={max}
              aria-valuenow={parsed ?? undefined}
              aria-valuetext={
                parsed === null ? undefined : `${format(parsed)} ${unit ?? ""}`.trim()
              }
              aria-invalid={problem !== null && draft !== null}
              aria-describedby={`${id}-hint`}
              readOnly={locked}
              value={text}
              onChange={(event: ChangeEvent<HTMLInputElement>) => edit(event.target.value)}
              onKeyDown={onKeyDown}
              size={1}
              className={cn(
                "w-0 min-w-0 flex-1 bg-transparent text-xl font-medium tabular-nums outline-none",
                unit ? "text-right" : "text-center",
              )}
            />
            {unit ? (
              <span aria-hidden className="text-muted-foreground flex-1 pl-1.5 text-sm">
                {unit}
              </span>
            ) : null}
            <button
              type="button"
              tabIndex={-1}
              aria-label="Increase"
              disabled={locked}
              className="text-muted-foreground hover:text-foreground h-full touch-manipulation px-3.5 text-lg select-none disabled:pointer-events-none"
              onClick={() => nudge(1, false)}
            >
              +
            </button>
          </div>
          <Button
            type="button"
            size="lg"
            className="h-12 min-w-24"
            disabled={locked || !dirty || problem !== null}
            onClick={apply}
          >
            {pending ? "Sent" : armed ? "Confirm" : "Apply"}
          </Button>
        </div>
        <p
          id={`${id}-hint`}
          className={cn(
            "min-h-4 text-xs",
            problem !== null && draft !== null ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {problem !== null && draft !== null
            ? problem
            : armed && parsed !== null
              ? `Press Confirm to send ${format(parsed)}${unit ? ` ${unit}` : ""}`
              : dirty
                ? "Not sent"
                : `${min} to ${max}${unit ? ` ${unit}` : ""}`}
        </p>
      </div>

      <div className="@container">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm font-medium tabular-nums @min-[360px]:grid-cols-4">
          <div className="flex flex-col gap-1">
            <dt>
              <InstrumentLabel>Setpoint</InstrumentLabel>
            </dt>
            <dd className={confirmedTone}>
              {confirmed === null ? "--" : `${format(confirmed)}${unit ? ` ${unit}` : ""}`}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt>
              <InstrumentLabel>Commanded</InstrumentLabel>
            </dt>
            <dd>{commanded === null ? "--" : `${format(commanded)}${unit ? ` ${unit}` : ""}`}</dd>
          </div>
          {value !== undefined ? (
            <div className="flex flex-col gap-1">
              <dt>
                <InstrumentLabel>Measured</InstrumentLabel>
              </dt>
              <dd>{value === null ? "--" : `${format(value)}${unit ? ` ${unit}` : ""}`}</dd>
            </div>
          ) : null}
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
