// benchcn.dev · stepper
// Step maths for the stepped controls: values snap to a grid anchored at `min`, stop or wrap at
// the ends, and pointer travel turns into whole detents so a slow drag never loses a step.

export type StepRange = {
  min: number;
  max: number;
  step: number;
  /** Past `max` comes back round to `min`, and the other way, like a channel selector. */
  wrap?: boolean;
};

export function decimalsOf(step: number): number {
  const text = String(step);
  return text.includes(".") ? text.split(".")[1].length : 0;
}

/** Rounds away binary drift, so ten steps of 0.1 land on 1 and not 0.9999999999999999. */
export function roundTo(value: number, decimals: number): number {
  return Number(value.toFixed(decimals));
}

export function stepValue(value: number, steps: number, range: StepRange): number {
  const { min, max, step, wrap = false } = range;
  const digits = Math.max(decimalsOf(step), decimalsOf(min));
  const snapped = min + Math.round((value - min) / step + steps) * step;
  if (!wrap) return roundTo(Math.min(max, Math.max(min, snapped)), digits);
  // One extra step closes the loop: 0 to 359 by 1 has 360 positions, so 359 + 1 is 0.
  const span = max - min + step;
  const offset = (((snapped - min) % span) + span) % span;
  return roundTo(min + offset, digits);
}

/** Where `value` sits between `min` and `max`, from 0 to 1. */
export function fractionOf(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

/** Whole detents in `travel`, and the travel left over for the next move. */
export function detentsFromTravel(
  travel: number,
  perDetent: number,
): { detents: number; remainder: number } {
  const detents = Math.trunc(travel / perDetent);
  return { detents, remainder: travel - detents * perDetent };
}
