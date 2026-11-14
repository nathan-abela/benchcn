// benchcn.dev · rotary-encoder
// A detented knob for a numeric setpoint, like the encoder on a bench supply. Each click moves one
// step and turning stays local until the hand stops, then one command goes out. The ring shows
// what was asked for and a mark on it shows what the device confirmed, so a clamp is visible.
import {
  type ComponentProps,
  type KeyboardEvent,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";
import {
  INSTRUMENT_FRAME,
  InstrumentLabel,
  useReducedMotion,
} from "@/registry/benchcn/lib/instrument";
import { createSettle, type Settle } from "@/registry/benchcn/lib/pacing";
import {
  decimalsOf,
  detentsFromTravel,
  fractionOf,
  stepValue,
} from "@/registry/benchcn/lib/stepper";

export type RotaryEncoderStatus =
  | "unknown"
  | "idle"
  | "draft"
  | "pending"
  | "confirmed"
  | "mismatch"
  | "error";

export type RotaryEncoderProps = Omit<ComponentProps<"div">, "onChange"> & {
  label: ReactNode;
  description?: ReactNode;
  unit?: string;
  min: number;
  max: number;
  /** One detent. Shift or Page Up/Down move ten. */
  step?: number;
  /** Decimal places. Defaults to the decimals of `step`. */
  precision?: number;
  /** Past `max` comes back round to `min`, and the other way. */
  wrap?: boolean;
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
  /** Called once per gesture, after the knob has been still for `settleMs`. */
  onCommand: (next: number) => void;
  /** The push button: a click without turning, Enter or Space. */
  onPress?: () => void;
  /** What a press does, such as "Change step". Shown under the knob and read to screen readers. */
  pressLabel?: string;
  /** Quiet time after the last detent before the value is sent. 0 sends every detent. */
  settleMs?: number;
  disabled?: boolean;
};

const PX_PER_DETENT = 12;
const WHEEL_PER_DETENT = 50;
const DETENTS_PER_TURN = 24;
const SWEEP = 270;
const CLICK_SLOP = 4;

const STATUS_TEXT: Record<RotaryEncoderStatus, string> = {
  unknown: "Unknown",
  idle: "Idle",
  draft: "Not sent",
  pending: "Waiting",
  confirmed: "Confirmed",
  mismatch: "Mismatch",
  error: "Error",
};

const STATUS_DOT: Record<RotaryEncoderStatus, string> = {
  unknown: "bg-muted-foreground/40",
  idle: "bg-muted-foreground/60",
  draft: "bg-muted-foreground/60",
  pending: "bg-warning motion-safe:animate-pulse",
  confirmed: "bg-success",
  mismatch: "bg-warning",
  error: "bg-destructive",
};

const MARK_FILL: Partial<Record<RotaryEncoderStatus, string>> = {
  confirmed: "var(--success)",
  mismatch: "var(--warning)",
  error: "var(--destructive)",
};

export function rotaryEncoderStatus(
  props: Pick<RotaryEncoderProps, "commanded" | "confirmed" | "pending" | "error">,
  draft: number | null,
  tolerance: number,
): RotaryEncoderStatus {
  if (draft !== null) return "draft";
  if (props.pending) return "pending";
  if (props.error) return "error";
  if (props.confirmed === null) return "unknown";
  if (props.commanded === null) return "idle";
  if (Math.abs(props.commanded - props.confirmed) > tolerance) return "mismatch";
  return "confirmed";
}

/** A point on the dial, `degrees` clockwise from straight up. */
function polar(radius: number, degrees: number): { x: number; y: number } {
  const a = (degrees * Math.PI) / 180;
  // Server and browser can disagree in the last digit of sin and cos, which breaks hydration.
  const round = (n: number) => Math.round(n * 1000) / 1000;
  return { x: round(60 + radius * Math.sin(a)), y: round(60 - radius * Math.cos(a)) };
}

const ARC_START = polar(54, -SWEEP / 2);
const ARC_END = polar(54, SWEEP / 2);
const ARC = `M ${ARC_START.x} ${ARC_START.y} A 54 54 0 1 1 ${ARC_END.x} ${ARC_END.y}`;
const KNURL = Array.from({ length: DETENTS_PER_TURN }, (_, i) => {
  const angle = (360 / DETENTS_PER_TURN) * i;
  return { from: polar(37, angle), to: polar(41, angle) };
});
const INDICATOR = polar(32, 0);

export function RotaryEncoder({
  label,
  description,
  unit,
  min,
  max,
  step = 1,
  precision,
  wrap = false,
  commanded,
  confirmed,
  pending = false,
  error = null,
  latency = null,
  updatedAt: _updatedAt,
  onCommand,
  onPress,
  pressLabel,
  settleMs = 300,
  disabled = false,
  className,
  children,
  ...props
}: RotaryEncoderProps): ReactElement {
  const id = useId();
  const reduced = useReducedMotion();
  const digits = precision ?? decimalsOf(step);
  const format = (n: number) => n.toFixed(digits);
  const withUnit = (n: number) => `${format(n)}${unit ? ` ${unit}` : ""}`;

  const [draft, setDraft] = useState<number | null>(null);
  const [turns, setTurns] = useState(0);
  const [pressed, setPressed] = useState(false);
  const draftRef = useRef<number | null>(null);
  const drag = useRef<{ x: number; y: number; travel: number; moved: number } | null>(null);
  const wheel = useRef(0);
  const knob = useRef<HTMLDivElement>(null);
  const commandRef = useRef(onCommand);
  const turnRef = useRef<(detents: number) => void>(() => {});

  useEffect(() => {
    commandRef.current = onCommand;
  }, [onCommand]);

  const settle = useRef<Settle<number> | null>(null);
  useEffect(() => {
    const created = createSettle((value: number) => {
      draftRef.current = null;
      setDraft(null);
      commandRef.current(value);
    }, settleMs);
    settle.current = created;
    return () => created.flush();
  }, [settleMs]);

  const status = rotaryEncoderStatus({ commanded, confirmed, pending, error }, draft, step / 2);
  const shown = draft ?? commanded ?? confirmed;

  const turn = (detents: number) => {
    if (disabled || detents === 0) return;
    setTurns((t) => t + detents);
    const base = draftRef.current ?? commanded ?? confirmed ?? min;
    const next = stepValue(base, detents, { min, max, step, wrap });
    if (next === base && draftRef.current === null) return;
    draftRef.current = next;
    setDraft(next);
    settle.current?.push(next);
  };
  const turnTo = (target: number) => {
    const base = draftRef.current ?? commanded ?? confirmed ?? min;
    turn(Math.round((target - base) / step));
  };
  const revert = () => {
    settle.current?.cancel();
    draftRef.current = null;
    setDraft(null);
  };
  const press = () => {
    if (!disabled) onPress?.();
  };

  useEffect(() => {
    turnRef.current = turn;
  });

  // React's wheel listener is passive, and a focused knob must keep the page from scrolling. An
  // unfocused knob never takes the wheel, so scrolling past it cannot change a setpoint.
  useEffect(() => {
    const element = knob.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      if (document.activeElement !== element) return;
      event.preventDefault();
      const px = event.deltaMode === 0 ? event.deltaY : event.deltaY * WHEEL_PER_DETENT;
      if (Math.abs(px) >= WHEEL_PER_DETENT) {
        wheel.current = 0;
        turnRef.current(-Math.sign(px));
        return;
      }
      const { detents, remainder } = detentsFromTravel(wheel.current - px, WHEEL_PER_DETENT);
      wheel.current = remainder;
      turnRef.current(detents);
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, []);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, travel: 0, moved: 0 };
    setPressed(true);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = event.clientX - d.x;
    const dy = event.clientY - d.y;
    d.x = event.clientX;
    d.y = event.clientY;
    d.moved += Math.abs(dx) + Math.abs(dy);
    const { detents, remainder } = detentsFromTravel(d.travel + dx - dy, PX_PER_DETENT);
    d.travel = remainder;
    turn(detents);
  };
  const endDrag = (asPress: boolean) => {
    const d = drag.current;
    drag.current = null;
    setPressed(false);
    if (asPress && d && d.moved < CLICK_SLOP) press();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const ten = event.shiftKey ? 10 : 1;
    const keys: Record<string, () => void> = {
      ArrowUp: () => turn(ten),
      ArrowRight: () => turn(ten),
      ArrowDown: () => turn(-ten),
      ArrowLeft: () => turn(-ten),
      PageUp: () => turn(10),
      PageDown: () => turn(-10),
      Home: () => turnTo(min),
      End: () => turnTo(max),
      Escape: revert,
      Enter: () => !event.repeat && press(),
      " ": () => !event.repeat && press(),
    };
    const action = keys[event.key];
    if (!action || disabled) return;
    event.preventDefault();
    action();
  };

  const fraction = shown === null ? 0 : fractionOf(shown, min, max);
  const mark =
    confirmed === null ? null : polar(54, -SWEEP / 2 + SWEEP * fractionOf(confirmed, min, max));
  const range = `${format(min)} to ${withUnit(max)}`;
  const hint = pressLabel ? `${range} · press to ${pressLabel.toLowerCase()}` : range;

  return (
    <div
      data-slot="rotary-encoder"
      data-status={status}
      className={cn(INSTRUMENT_FRAME, "gap-4", disabled && "opacity-60", className)}
      {...props}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span id={`${id}-label`} className="truncate text-sm font-medium">
            {label}
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

      <div className="flex flex-col items-center gap-2">
        <div
          ref={knob}
          // A native range input cannot be turned by dragging in a circle or pressed like a button.
          // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-labelledby={`${id}-label`}
          aria-describedby={`${id}-hint`}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={shown ?? undefined}
          aria-valuetext={shown === null ? "Unknown" : withUnit(shown)}
          aria-disabled={disabled || undefined}
          data-pressed={pressed || undefined}
          className={cn(
            "focus-visible:ring-ring/50 relative size-40 touch-none rounded-full outline-none select-none focus-visible:ring-[3px]",
            disabled ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing",
          )}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => endDrag(true)}
          onPointerCancel={() => endDrag(false)}
          onLostPointerCapture={() => endDrag(false)}
          onKeyDown={onKeyDown}
          onBlur={() => settle.current?.flush()}
          onContextMenu={(event) => event.preventDefault()}
        >
          <svg aria-hidden viewBox="0 0 120 120" className="size-full overflow-visible">
            <path d={ARC} fill="none" stroke="var(--muted)" strokeWidth={4} strokeLinecap="round" />
            {shown === null ? null : (
              <path
                d={ARC}
                pathLength={100}
                fill="none"
                stroke="var(--primary)"
                strokeWidth={4}
                strokeLinecap="round"
                strokeDasharray={`${fraction * 100} 100`}
              />
            )}
            {mark ? (
              <circle
                cx={mark.x}
                cy={mark.y}
                r={4}
                fill={MARK_FILL[status] ?? "var(--muted-foreground)"}
                stroke="var(--card)"
                strokeWidth={2}
              />
            ) : null}
            <g
              style={{
                transform: `scale(${pressed ? 0.96 : 1})`,
                transformOrigin: "60px 60px",
                transition: reduced ? "none" : "transform 100ms ease-out",
              }}
            >
              <circle cx={60} cy={60} r={42} fill="var(--background)" stroke="var(--border)" />
              <g
                style={{
                  transform: `rotate(${(turns * 360) / DETENTS_PER_TURN}deg)`,
                  transformOrigin: "60px 60px",
                  transition: reduced ? "none" : "transform 90ms ease-out",
                }}
              >
                {KNURL.map(({ from, to }) => (
                  <line
                    key={`${from.x}:${from.y}`}
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    stroke="var(--border)"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                  />
                ))}
                <circle cx={INDICATOR.x} cy={INDICATOR.y} r={2.5} fill="var(--foreground)" />
              </g>
            </g>
          </svg>
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
          >
            <span className="text-xl leading-none font-medium tabular-nums">
              {shown === null ? "--" : format(shown)}
            </span>
            {unit ? <span className="text-muted-foreground mt-1 text-xs">{unit}</span> : null}
          </span>
        </div>
        <p id={`${id}-hint`} className="text-muted-foreground text-xs">
          {hint}
        </p>
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
