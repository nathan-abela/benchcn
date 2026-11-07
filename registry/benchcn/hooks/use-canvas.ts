// benchcn.dev · use-canvas
// Sizes a canvas to its CSS box at device pixel ratio and runs a draw loop that pauses while the
// element is offscreen or the tab is hidden, and drops to a few frames per second when the user
// prefers reduced motion. Static canvases redraw on resize and on demand.
import { type RefObject, useCallback, useEffect, useRef } from "react";

export type CanvasFrame = {
  ctx: CanvasRenderingContext2D;
  /** CSS pixel size; the context is already scaled by `dpr`. */
  width: number;
  height: number;
  dpr: number;
  /** `performance.now()` of this frame and the milliseconds since the previous one. */
  time: number;
  delta: number;
};

export type UseCanvasOptions = {
  draw: (frame: CanvasFrame) => void;
  /** Keep drawing every frame. When false the canvas is drawn on resize and on `redraw()`. */
  running?: boolean;
  /** Frame rate cap; 0 means every animation frame. */
  fps?: number;
};

export type CanvasHandle = {
  /** Draws once on the next animation frame. A no-op while running, which draws anyway. Also
   * called whenever `draw` changes. */
  redraw: () => void;
};

const REDUCED_MOTION_FPS = 4;

export function useCanvas(
  ref: RefObject<HTMLCanvasElement | null>,
  { draw, running = true, fps = 0 }: UseCanvasOptions,
): CanvasHandle {
  const drawRef = useRef(draw);
  const renderRef = useRef<() => void>(() => {});
  const pending = useRef(0);

  const redraw = useCallback(() => {
    if (running || pending.current) return;
    pending.current = requestAnimationFrame(() => {
      pending.current = 0;
      renderRef.current();
    });
  }, [running]);

  useEffect(() => {
    drawRef.current = draw;
    redraw();
  }, [draw, redraw]);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let width = 1;
    let height = 1;
    let dpr = 1;
    let visible = true;
    let raf = 0;
    let last = 0;

    const render = (time: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawRef.current({ ctx, width, height, dpr, time, delta: last ? time - last : 0 });
      last = time;
    };
    renderRef.current = () => render(performance.now());

    const active = () => running && visible && !document.hidden;

    const loop = (time: number) => {
      raf = 0;
      if (!active()) return;
      const cap = reduced.matches ? REDUCED_MOTION_FPS : fps;
      if (cap === 0 || time - last >= 1000 / cap - 1) render(time);
      raf = requestAnimationFrame(loop);
    };

    const schedule = () => {
      if (raf === 0 && active()) raf = requestAnimationFrame(loop);
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 3);
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      render(performance.now());
      schedule();
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);

    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
      schedule();
    });
    intersectionObserver.observe(canvas);

    const onVisibility = () => schedule();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      if (raf) cancelAnimationFrame(raf);
      renderRef.current = () => {};
    };
  }, [ref, running, fps]);

  useEffect(() => {
    return () => {
      if (pending.current) cancelAnimationFrame(pending.current);
    };
  }, []);

  return { redraw };
}
