// benchcn.dev · joystick
// A virtual joystick for teleoperation: drive a robot from a touch pad, the keyboard or a gamepad's
// left stick. It sends at a
// fixed rate while held and a single zero the moment input stops, so the robot's own watchdog,
// not the page, is the last line of defence when the connection drops.
//
// Gamepad axes follow the W3C Standard Gamepad mapping (https://w3c.github.io/gamepad/#remapping):
// axes[0] is the left stick horizontal (negative left), axes[1] its vertical (negative up).
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

/** `x` turns (positive right), `y` drives (positive forward); both from -1 to 1. */
export type JoystickVector = { x: number; y: number };

export type JoystickSource = "idle" | "pointer" | "keyboard" | "gamepad";

export type JoystickProps = Omit<ComponentProps<"div">, "onChange"> & {
  label?: ReactNode;
  /** Called `rate` times a second while there is input, and once with zero when it stops. */
  onChange: (vector: JoystickVector) => void;
  /** Sends per second while held. */
  rate?: number;
  /** Fraction of the stick's travel ignored around the centre. */
  deadzone?: number;
  /** Read the first connected gamepad's left stick. */
  gamepad?: boolean;
  disabled?: boolean;
};

export const ZERO: JoystickVector = { x: 0, y: 0 };

/** Keeps a vector inside the unit circle, so a diagonal is no faster than straight ahead. */
export function clampToCircle({ x, y }: JoystickVector): JoystickVector {
  const length = Math.hypot(x, y);
  return length > 1 ? { x: x / length, y: y / length } : { x, y };
}

/** A radial deadzone that rescales what is left, so motion starts smoothly from zero. */
export function applyDeadzone(vector: JoystickVector, deadzone: number): JoystickVector {
  const length = Math.hypot(vector.x, vector.y);
  if (length <= deadzone) return ZERO;
  const scaled = Math.min(1, (length - deadzone) / (1 - deadzone));
  return { x: (vector.x / length) * scaled, y: (vector.y / length) * scaled };
}

const KEYS: Record<string, JoystickVector> = {
  ArrowUp: { x: 0, y: 1 },
  w: { x: 0, y: 1 },
  ArrowDown: { x: 0, y: -1 },
  s: { x: 0, y: -1 },
  ArrowLeft: { x: -1, y: 0 },
  a: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  d: { x: 1, y: 0 },
};

export function keysToVector(keys: Iterable<string>): JoystickVector {
  let x = 0;
  let y = 0;
  for (const key of keys) {
    const step = KEYS[key.length === 1 ? key.toLowerCase() : key];
    if (step) {
      x += step.x;
      y += step.y;
    }
  }
  return clampToCircle({ x: Math.sign(x), y: Math.sign(y) });
}

const isZero = (v: JoystickVector) => v.x === 0 && v.y === 0;

export function Joystick({
  label = "Joystick",
  onChange,
  rate = 10,
  deadzone = 0.12,
  gamepad = true,
  disabled = false,
  className,
  children,
  ...props
}: JoystickProps): ReactElement {
  const [vector, setVector] = useState<JoystickVector>(ZERO);
  const [source, setSource] = useState<JoystickSource>("idle");
  const [padConnected, setPadConnected] = useState(false);
  const keys = useRef(new Set<string>());
  const pointerVector = useRef<JoystickVector | null>(null);
  const current = useRef<{ vector: JoystickVector; source: JoystickSource }>({
    vector: ZERO,
    source: "idle",
  });
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Pointer beats keyboard beats gamepad, so a held key cannot fight a finger on the knob.
  const publish = (next: JoystickVector, from: JoystickSource) => {
    const wasMoving = !isZero(current.current.vector);
    const value = disabled ? ZERO : next;
    current.current = { vector: value, source: isZero(value) ? "idle" : from };
    setVector(value);
    setSource(current.current.source);
    if (wasMoving && isZero(value)) onChangeRef.current(ZERO);
  };

  const resolve = (gamepadVector: JoystickVector = ZERO) => {
    if (pointerVector.current) return publish(pointerVector.current, "pointer");
    const fromKeys = keysToVector(keys.current);
    if (!isZero(fromKeys)) return publish(fromKeys, "keyboard");
    return publish(gamepadVector, "gamepad");
  };
  const resolveRef = useRef(resolve);

  useEffect(() => {
    resolveRef.current = resolve;
  });

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!isZero(current.current.vector)) onChangeRef.current(current.current.vector);
    }, 1000 / rate);
    return () => window.clearInterval(timer);
  }, [rate]);

  useEffect(() => {
    if (!disabled || isZero(current.current.vector)) return;
    current.current = { vector: ZERO, source: "idle" };
    setVector(ZERO);
    setSource("idle");
    onChangeRef.current(ZERO);
  }, [disabled]);

  useEffect(() => {
    if (!gamepad || typeof navigator === "undefined" || !navigator.getGamepads) return;
    let frame = 0;
    const poll = () => {
      const pad = [...navigator.getGamepads()].find((g) => g?.connected);
      setPadConnected(Boolean(pad));
      if (pad && !pointerVector.current && keys.current.size === 0) {
        const stick = applyDeadzone({ x: pad.axes[0] ?? 0, y: -(pad.axes[1] ?? 0) }, deadzone);
        const changed =
          Math.abs(stick.x - current.current.vector.x) > 0.01 ||
          Math.abs(stick.y - current.current.vector.y) > 0.01;
        if (changed) resolveRef.current(stick);
      }
      frame = requestAnimationFrame(poll);
    };
    frame = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(frame);
  }, [gamepad, deadzone]);

  const fromPointer = (event: PointerEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const radius = rect.width / 2;
    return clampToCircle({
      x: (event.clientX - rect.left - radius) / radius,
      y: -(event.clientY - rect.top - radius) / radius,
    });
  };

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (disabled || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerVector.current = fromPointer(event);
    resolve();
  };
  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (!pointerVector.current) return;
    pointerVector.current = fromPointer(event);
    resolve();
  };
  const release = () => {
    if (!pointerVector.current) return;
    pointerVector.current = null;
    resolve();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (!(key in KEYS) || disabled) return;
    event.preventDefault();
    keys.current.add(key);
    resolve();
  };
  const onKeyUp = (event: KeyboardEvent<HTMLButtonElement>) => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (!keys.current.delete(key)) return;
    resolve();
  };
  const onBlur = () => {
    keys.current.clear();
    resolve();
  };

  const knob = { left: `${50 + vector.x * 38}%`, top: `${50 - vector.y * 38}%` };

  return (
    <div
      data-slot="joystick"
      data-source={source}
      className={cn(INSTRUMENT_FRAME, "gap-4", disabled && "opacity-60", className)}
      {...props}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">{label}</span>
        <InstrumentLabel>
          {disabled ? "Disabled" : padConnected ? "Gamepad connected" : "Pad, keys or gamepad"}
        </InstrumentLabel>
      </div>

      <div className="flex flex-1 items-center justify-center">
        <button
          type="button"
          aria-roledescription="joystick"
          aria-label="Joystick. Arrow keys or W A S D to drive, release to stop."
          disabled={disabled}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={release}
          onPointerCancel={release}
          onKeyDown={onKeyDown}
          onKeyUp={onKeyUp}
          onBlur={onBlur}
          className={cn(
            "bg-background focus-visible:ring-ring/50 relative size-44 touch-none rounded-full border outline-none select-none focus-visible:ring-[3px]",
            disabled ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing",
          )}
        >
          <span aria-hidden className="bg-border absolute inset-x-6 top-1/2 h-px" />
          <span aria-hidden className="bg-border absolute inset-y-6 left-1/2 w-px" />
          <span
            aria-hidden
            className={cn(
              "absolute size-12 -translate-x-1/2 -translate-y-1/2 rounded-full border shadow-sm",
              source === "idle" ? "bg-muted" : "bg-primary border-primary",
            )}
            style={knob}
          />
        </button>
      </div>

      <dl className="grid grid-cols-3 gap-x-4 text-sm font-medium tabular-nums">
        <div className="flex flex-col gap-1">
          <dt>
            <InstrumentLabel>Forward</InstrumentLabel>
          </dt>
          <dd>{vector.y.toFixed(2)}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt>
            <InstrumentLabel>Turn</InstrumentLabel>
          </dt>
          <dd>{vector.x.toFixed(2)}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt>
            <InstrumentLabel>Input</InstrumentLabel>
          </dt>
          <dd className="capitalize">{source}</dd>
        </div>
      </dl>
      {children}
    </div>
  );
}
