// benchcn.dev · d-pad
// Stepped jogging for a CNC or printer axis, or a camera's pan and tilt. Each press moves exactly
// one step and holding repeats like a held key, so the machine only ever moves by amounts the
// user picked. Continuous velocity is the joystick's job.
import {
  type ComponentProps,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { INSTRUMENT_FRAME, InstrumentLabel } from "@/registry/benchcn/lib/instrument";
import { createRepeater, type Repeater } from "@/registry/benchcn/lib/pacing";
import { decimalsOf } from "@/registry/benchcn/lib/stepper";

export type DPadDirection = "up" | "down" | "left" | "right";

/** One step: `x` positive right, `y` positive up, in `unit`. */
export type DPadMove = { direction: DPadDirection; x: number; y: number };

export type DPadProps = Omit<ComponentProps<"div">, "onChange"> & {
  label?: ReactNode;
  description?: ReactNode;
  unit?: string;
  /** Step sizes to choose from. */
  steps?: number[];
  defaultStep?: number;
  onStepChange?: (step: number) => void;
  /** Called once per step: at press, then every `repeatInterval` while held. */
  onJog: (move: DPadMove) => void;
  /** Shows a centre button. */
  onHome?: () => void;
  /** Milliseconds held before repeating starts. */
  repeatDelay?: number;
  /** Milliseconds between repeated steps. */
  repeatInterval?: number;
  /** Where the device says it is. Leave out to hide the readouts. */
  position?: { x?: number | null; y?: number | null };
  axes?: { x?: string; y?: string };
  pending?: boolean;
  error?: string | null;
  disabled?: boolean;
};

export function jogMove(direction: DPadDirection, step: number): DPadMove {
  const x = direction === "right" ? step : direction === "left" ? -step : 0;
  const y = direction === "up" ? step : direction === "down" ? -step : 0;
  return { direction, x, y };
}

const KEYS: Record<string, DPadDirection> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

const ROTATION: Record<DPadDirection, number> = { up: 0, right: 90, down: 180, left: 270 };

const DEFAULT_STEPS = [0.1, 1, 10];

const CELL =
  "bg-background flex size-12 touch-manipulation items-center justify-center rounded-lg border select-none outline-none transition-colors duration-100 disabled:cursor-not-allowed";

export function DPad({
  label = "Jog",
  description,
  unit = "mm",
  steps = DEFAULT_STEPS,
  defaultStep,
  onStepChange,
  onJog,
  onHome,
  repeatDelay = 400,
  repeatInterval = 150,
  position,
  axes,
  pending = false,
  error = null,
  disabled = false,
  className,
  children,
  ...props
}: DPadProps): ReactElement {
  const id = useId();
  const [step, setStep] = useState(defaultStep ?? steps[Math.min(1, steps.length - 1)]);
  const [active, setActive] = useState<DPadDirection | null>(null);
  const held = useRef<{ direction: DPadDirection; repeater: Repeater } | null>(null);
  const latest = useRef({ onJog, step });
  const xName = axes?.x ?? "X";
  const yName = axes?.y ?? "Y";
  const digits = Math.max(0, ...steps.map(decimalsOf));
  const format = (n: number) => `${n.toFixed(digits)} ${unit}`;

  useEffect(() => {
    latest.current = { onJog, step };
  });

  const stop = () => {
    held.current?.repeater.stop();
    held.current = null;
    setActive(null);
  };
  const start = (direction: DPadDirection) => {
    if (disabled || held.current?.direction === direction) return;
    held.current?.repeater.stop();
    const repeater = createRepeater(
      () => latest.current.onJog(jogMove(direction, latest.current.step)),
      { delay: repeatDelay, interval: repeatInterval },
    );
    held.current = { direction, repeater };
    setActive(direction);
    repeater.start();
  };
  const stopRef = useRef(stop);

  useEffect(() => {
    stopRef.current = stop;
  });

  // Holding must end when the release cannot arrive: another window takes focus, the tab hides,
  // or the pad unmounts mid-hold.
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

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const direction = KEYS[event.key];
    if (direction) {
      event.preventDefault();
      if (!event.repeat) start(direction);
    } else if (event.key === "Home" && onHome && !disabled) {
      event.preventDefault();
      onHome();
    }
  };
  const onKeyUp = (event: KeyboardEvent<HTMLDivElement>) => {
    if (KEYS[event.key] === held.current?.direction) stop();
  };
  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) stop();
  };

  const pick = (next: number) => {
    setStep(next);
    onStepChange?.(next);
  };

  const arrow = (direction: DPadDirection, axis: string, sign: string, area: string) => (
    <button
      type="button"
      tabIndex={-1}
      disabled={disabled}
      aria-label={`${axis} ${sign}${format(step)}`}
      data-active={active === direction || undefined}
      className={cn(
        CELL,
        area,
        "data-active:bg-primary data-active:text-primary-foreground data-active:border-primary",
      )}
      onPointerDown={(event: PointerEvent<HTMLButtonElement>) => {
        if (event.button === 0) start(direction);
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onPointerLeave={stop}
      onContextMenu={(event) => event.preventDefault()}
    >
      <svg
        aria-hidden
        viewBox="0 0 12 12"
        className="size-3"
        style={{ transform: `rotate(${ROTATION[direction]}deg)` }}
      >
        <path d="M6 2.5 10 8.5H2z" fill="currentColor" />
      </svg>
    </button>
  );

  const status = disabled ? "Disabled" : pending ? "Waiting" : error ? "Error" : "Ready";

  return (
    <div
      data-slot="d-pad"
      data-status={status.toLowerCase()}
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
          <span
            aria-hidden
            className={cn(
              "size-1.5 rounded-full",
              pending
                ? "bg-warning motion-safe:animate-pulse"
                : error
                  ? "bg-destructive"
                  : "bg-muted-foreground/60",
            )}
          />
          {status}
        </span>
      </div>

      <div className="@container">
        <div className="flex flex-col items-center gap-4 @[22rem]:flex-row @[22rem]:items-center @[22rem]:justify-center @[22rem]:gap-10">
          {/* One tab stop that takes the arrow keys, so the arrows themselves stay out of the tab order. */}
          {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
          <div
            // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
            role="group"
            tabIndex={disabled ? -1 : 0}
            aria-labelledby={`${id}-label`}
            aria-describedby={`${id}-keys`}
            className="focus-visible:ring-ring/50 grid grid-cols-[repeat(3,3rem)] grid-rows-[repeat(3,3rem)] gap-1.5 rounded-xl p-1 outline-none focus-visible:ring-[3px]"
            onKeyDown={onKeyDown}
            onKeyUp={onKeyUp}
            onBlur={onBlur}
          >
            <span id={`${id}-keys`} className="sr-only">
              Arrow keys step, hold to repeat{onHome ? ", Home to go home" : ""}.
            </span>
            {arrow("up", yName, "+", "col-start-2 row-start-1")}
            {arrow("left", xName, "-", "col-start-1 row-start-2")}
            {onHome ? (
              <button
                type="button"
                tabIndex={-1}
                disabled={disabled}
                className={cn(
                  CELL,
                  "text-muted-foreground active:bg-muted col-start-2 row-start-2 text-xs",
                )}
                onClick={onHome}
              >
                Home
              </button>
            ) : null}
            {arrow("right", xName, "+", "col-start-3 row-start-2")}
            {arrow("down", yName, "-", "col-start-2 row-start-3")}
          </div>

          <div className="flex w-full flex-col gap-3 @[22rem]:w-auto">
            <fieldset className="min-w-0">
              <legend className="mb-1.5">
                <InstrumentLabel>Step</InstrumentLabel>
              </legend>
              <div className="flex gap-1">
                {steps.map((size) => (
                  <Button
                    key={size}
                    type="button"
                    size="sm"
                    variant={size === step ? "default" : "outline"}
                    aria-pressed={size === step}
                    disabled={disabled}
                    className="min-w-12 flex-1 touch-manipulation tabular-nums"
                    onClick={() => pick(size)}
                  >
                    {size.toFixed(decimalsOf(size))}
                  </Button>
                ))}
              </div>
            </fieldset>
            {position ? (
              <dl className="grid grid-cols-2 gap-x-4 text-sm font-medium tabular-nums">
                {(
                  [
                    [xName, position.x],
                    [yName, position.y],
                  ] as const
                ).map(([name, value]) => (
                  <div key={name} className="flex flex-col gap-1">
                    <dt>
                      <InstrumentLabel>{name}</InstrumentLabel>
                    </dt>
                    <dd>{value === null || value === undefined ? "--" : format(value)}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {error ? <p className="text-destructive text-xs">{error}</p> : null}
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}
