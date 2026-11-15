import { motion } from "motion/react";
import { type KeyboardEvent, type PointerEvent, type ReactElement, useRef, useState } from "react";

import { CATALOG } from "@/lib/studio/catalog";
import { dropIndex, type Span, stepSpan, type Widget } from "@/lib/studio/model";
import { cn } from "@/lib/utils";
import type { SourceHandle } from "@/registry/benchcn/lib/source-store";

import { WidgetView } from "./widget-view";

// Literal class names so Tailwind generates every span the canvas can show.
const SPAN_CLASS: Record<Span, string> = {
  3: "md:col-span-3",
  4: "md:col-span-4",
  6: "md:col-span-6",
  8: "md:col-span-8",
  12: "md:col-span-12",
};

export type CanvasProps = {
  widgets: Widget[];
  source: SourceHandle;
  selected: string | null;
  onSelect: (id: string | null) => void;
  onMove: (id: string, to: number) => void;
  onResize: (id: string, span: Span) => void;
  onRemove: (id: string) => void;
  /** Stacks every card in one column, the way the exported grid lays out on a phone. */
  phone?: boolean;
};

export function Canvas({
  widgets,
  source,
  selected,
  onSelect,
  onMove,
  onResize,
  onRemove,
  phone = false,
}: CanvasProps): ReactElement {
  const grid = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const announce = (id: string, index: number) => {
    const widget = widgets.find((w) => w.id === id);
    if (widget) {
      setAnnouncement(`${nameOf(widget)}, position ${index + 1} of ${widgets.length}`);
    }
  };

  const move = (id: string, delta: number) => {
    const index = widgets.findIndex((w) => w.id === id);
    const to = Math.max(0, Math.min(widgets.length - 1, index + delta));
    if (to === index) return;
    onMove(id, to);
    announce(id, to);
  };

  const resize = (widget: Widget, direction: 1 | -1) => {
    const span = stepSpan(widget.span, direction, CATALOG[widget.type].minSpan);
    onResize(widget.id, span);
    setAnnouncement(`${nameOf(widget)}, ${span} of 12 columns`);
  };

  const onKey = (widget: Widget, event: KeyboardEvent, fromHandle: boolean) => {
    if (!fromHandle && !event.altKey) return;
    const { key, shiftKey } = event;
    if (shiftKey && (key === "ArrowLeft" || key === "ArrowRight")) {
      resize(widget, key === "ArrowRight" ? 1 : -1);
    } else if (key === "ArrowLeft" || key === "ArrowUp") {
      move(widget.id, -1);
    } else if (key === "ArrowRight" || key === "ArrowDown") {
      move(widget.id, 1);
    } else if (fromHandle && (key === "Delete" || key === "Backspace")) {
      onRemove(widget.id);
    } else {
      return;
    }
    event.preventDefault();
  };

  // Window listeners rather than pointer capture: reordering moves the handle in the DOM, which
  // would drop a capture mid-drag.
  const startDrag = (id: string, event: PointerEvent) => {
    event.preventDefault();
    setDragging(id);
    const onPointerMove = (pointerEvent: globalThis.PointerEvent) => {
      const container = grid.current;
      if (!container) return;
      const origin = container.getBoundingClientRect();
      const elements = [...container.querySelectorAll<HTMLElement>("[data-widget]")];
      // Layout positions, not transformed rectangles, so cards mid-animation do not move the target.
      const others = elements
        .filter((el) => el.dataset.widget !== id)
        .map((el) => ({
          left: el.offsetLeft,
          top: el.offsetTop,
          width: el.offsetWidth,
          height: el.offsetHeight,
        }));
      const pointer = {
        x: pointerEvent.clientX - origin.left,
        y: pointerEvent.clientY - origin.top,
      };
      const to = dropIndex(pointer, others);
      if (to !== elements.findIndex((el) => el.dataset.widget === id)) {
        onMove(id, to);
        announce(id, to);
      }
    };
    const end = () => {
      setDragging(null);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };

  if (widgets.length === 0) {
    return (
      <div className="text-muted-foreground grid h-48 place-items-center rounded-xl border border-dashed text-sm">
        Pick a component to add
      </div>
    );
  }

  return (
    <>
      <div ref={grid} className={cn("relative grid gap-4", !phone && "md:grid-cols-12")}>
        {widgets.map((widget) => {
          const isSelected = selected === widget.id;
          return (
            <motion.div
              key={widget.id}
              layout="position"
              transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
              data-widget={widget.id}
              data-selected={isSelected || undefined}
              onPointerDownCapture={() => onSelect(widget.id)}
              onFocusCapture={() => onSelect(widget.id)}
              onKeyDown={(event) => onKey(widget, event, false)}
              className={cn(
                "group/widget relative grid min-w-0 rounded-xl outline-offset-4 md:data-selected:outline-2 md:data-selected:outline-[color-mix(in_oklch,var(--primary)_45%,transparent)]",
                !phone && SPAN_CLASS[widget.span],
                dragging === widget.id && "z-20 opacity-60",
              )}
            >
              <button
                type="button"
                aria-label={`Move ${nameOf(widget)}`}
                aria-describedby="studio-handle-keys"
                onPointerDown={(event) => startDrag(widget.id, event)}
                onKeyDown={(event) => {
                  event.stopPropagation();
                  onKey(widget, event, true);
                }}
                className={cn(
                  "bg-background text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 absolute -top-3 left-1/2 z-10 hidden h-6 w-10 -translate-x-1/2 cursor-grab touch-none items-center justify-center rounded-full border opacity-0 shadow-sm transition-opacity duration-150 outline-none select-none group-hover/widget:opacity-100 focus-visible:opacity-100 focus-visible:ring-[3px] active:cursor-grabbing md:flex",
                  (isSelected || dragging === widget.id) && "opacity-100",
                )}
              >
                <GripIcon />
              </button>
              <WidgetView widget={widget} source={source} />
            </motion.div>
          );
        })}
      </div>
      <p id="studio-handle-keys" className="sr-only">
        Arrow keys move. Shift with Left or Right changes the width. Delete removes.
      </p>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </>
  );
}

export function nameOf(widget: Widget): string {
  const { label, title } = widget.props;
  if (typeof label === "string" && label !== "") return label;
  if (typeof title === "string" && title !== "") return title;
  return CATALOG[widget.type].title;
}

function GripIcon(): ReactElement {
  return (
    <svg viewBox="0 0 16 8" className="size-4 w-5" aria-hidden fill="currentColor">
      {[2, 6, 10, 14].flatMap((x) =>
        [2, 6].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r={1.1} />),
      )}
    </svg>
  );
}
