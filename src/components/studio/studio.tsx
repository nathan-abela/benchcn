import { MotionConfig } from "motion/react";
import { lazy, type ReactElement, Suspense, useEffect, useRef, useState } from "react";

import { CopyButton } from "@/components/site/copy-button";
import { Button } from "@/components/ui/button";
import { moveItem, type Widget, type WidgetType } from "@/lib/studio/model";
import { buildStudioPrompt } from "@/lib/studio/prompt";
import { createWidget, encodeState, SHARE_PREFIX } from "@/lib/studio/state";
import { cn } from "@/lib/utils";
import { useMockDevice } from "@/registry/benchcn/hooks/use-mock-device";
import { useWebSocketSource } from "@/registry/benchcn/hooks/use-websocket-source";
import type { SourceHandle } from "@/registry/benchcn/lib/source-store";
import { ConnectionStatus } from "@/registry/benchcn/ui/connection-status/connection-status";

import { Canvas } from "./canvas";
import { Segmented } from "./fields";
import { Inspector } from "./inspector";
import { Layers, Palette, SourcePanel } from "./panels";
import { useStudioStore } from "./studio-store";

const CodeView = lazy(() => import("./code-view").then((m) => ({ default: m.CodeView })));

type View = "design" | "code";
type Width = "desktop" | "phone";

// The dashboard keeps a page's width on wide screens so cards stay the size they will be in the
// exported page; the phone preview is a typical phone's width.
const ARTBOARD: Record<Width, string> = {
  desktop: "max-w-[1400px]",
  phone: "max-w-[390px]",
};

// Thin scrollbars in the border colour, so the panels do not show a desktop scrollbar with arrows.
const SCROLL = "[scrollbar-color:var(--color-border)_transparent] [scrollbar-width:thin]";

const PANEL = `bg-background flex min-h-0 shrink-0 flex-col overflow-y-auto ${SCROLL}`;

export function Studio(): ReactElement {
  const { state, shared, opening, edit, openDraft } = useStudioStore();
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<View>("design");
  const [width, setWidth] = useState<Width>("desktop");
  const [componentsOpen, setComponentsOpen] = useState(false);
  const [connected, setConnected] = useState<string | null>(null);
  const canvas = useRef<HTMLDivElement>(null);

  const mock = useMockDevice();
  const socket = useWebSocketSource(state.source.kind === "websocket" ? connected : null);
  const source: SourceHandle = state.source.kind === "mock" ? mock : socket;
  const channels = state.source.kind === "mock" ? mock.device.channels : (socket.hello?.chs ?? []);

  useEffect(() => {
    const close = () => {
      setSelected(null);
      setComponentsOpen(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.target === canvas.current) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const updateWidget = (widget: Widget) =>
    edit((s) => ({ ...s, widgets: s.widgets.map((w) => (w.id === widget.id ? widget : w)) }));

  const removeWidget = (id: string) => {
    edit((s) => ({ ...s, widgets: s.widgets.filter((w) => w.id !== id) }));
    setSelected(null);
  };

  const moveWidget = (id: string, to: number) =>
    edit((s) => ({
      ...s,
      widgets: moveItem(
        s.widgets,
        s.widgets.findIndex((w) => w.id === id),
        to,
      ),
    }));

  const addWidget = (type: WidgetType) => {
    const widget = createWidget(type, channels, state.widgets);
    edit((s) => ({ ...s, widgets: [...s.widgets, widget] }));
    setSelected(widget.id);
    setComponentsOpen(false);
    setView("design");
  };

  const select = (id: string | null) => {
    setSelected(id);
    setComponentsOpen(false);
  };

  const selectedWidget = state.widgets.find((w) => w.id === selected) ?? null;

  const shareUrl = async () =>
    `${window.location.origin}${window.location.pathname}${SHARE_PREFIX}${await encodeState(state)}`;

  const share = (
    <CopyButton text={shareUrl} label="Copy share link" variant="ghost" size="sm">
      Share
    </CopyButton>
  );

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex flex-col md:h-[calc(100dvh-4rem-1px)]">
        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          <aside
            aria-label="Components"
            className={cn(
              PANEL,
              "hidden w-64 gap-6 border-r p-4 xl:flex",
              componentsOpen &&
                "max-xl:absolute max-xl:inset-y-0 max-xl:left-0 max-xl:z-30 max-xl:flex max-xl:shadow-xl",
            )}
          >
            <SourcePanel
              state={state}
              source={source}
              connected={connected}
              onSource={(next) => {
                setConnected(null);
                edit((s) => ({ ...s, source: next }));
              }}
              onConnect={setConnected}
            />
            <Layers
              widgets={state.widgets}
              selected={selected}
              onSelect={(id) => {
                select(id);
                setView("design");
              }}
              onMove={moveWidget}
            />
            <Palette onAdd={addWidget} />
          </aside>

          <div className="relative flex min-w-0 flex-1 flex-col">
            {shared ? (
              <div className="flex items-center justify-between gap-3 border-b px-4 py-2 text-sm">
                <span className="text-muted-foreground">Shared layout</span>
                {shared.draft ? (
                  <Button variant="ghost" size="sm" onClick={openDraft}>
                    Open my draft
                  </Button>
                ) : null}
              </div>
            ) : null}
            <div
              ref={canvas}
              className={cn(
                "min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-24 transition-opacity duration-150 md:px-6 md:pt-6",
                SCROLL,
                "bg-[radial-gradient(color-mix(in_oklch,var(--color-foreground)_14%,transparent)_1px,transparent_1px)] bg-size-[20px_20px]",
                opening && "opacity-0",
              )}
            >
              {view === "code" ? (
                <Suspense fallback={null}>
                  <CodeView state={state} />
                </Suspense>
              ) : (
                <div className={cn("mx-auto w-full", ARTBOARD[width])}>
                  <Canvas
                    widgets={state.widgets}
                    source={source}
                    selected={selected}
                    phone={width === "phone"}
                    onSelect={select}
                    onMove={moveWidget}
                    onResize={(id, span) =>
                      edit((s) => ({
                        ...s,
                        widgets: s.widgets.map((w) => (w.id === id ? { ...w, span } : w)),
                      }))
                    }
                    onRemove={removeWidget}
                  />
                </div>
              )}
            </div>

            <div className="bg-card/90 fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 z-20 flex w-max -translate-x-1/2 items-center gap-1 rounded-xl border p-1 shadow-lg backdrop-blur-md md:absolute md:bottom-4">
              <Button
                variant="ghost"
                size="sm"
                className="hidden md:inline-flex xl:hidden"
                aria-expanded={componentsOpen}
                onClick={() => setComponentsOpen((open) => !open)}
              >
                Components
              </Button>
              <ConnectionStatus source={source} className="px-2 text-sm xl:hidden" />
              <Segmented
                label="View"
                className="md:hidden"
                value={view}
                options={[
                  { value: "design", label: "Dashboard" },
                  { value: "code", label: "Code" },
                ]}
                onChange={(next) => setView(next as View)}
              />
              {view === "design" ? (
                <Segmented
                  label="Preview width"
                  className="hidden md:grid"
                  value={width}
                  options={[
                    { value: "desktop", label: "Desktop" },
                    { value: "phone", label: "Phone" },
                  ]}
                  onChange={(next) => setWidth(next as Width)}
                />
              ) : null}
              {share}
            </div>
          </div>

          <aside
            aria-label={selectedWidget ? "Inspector" : "Export"}
            className={cn(PANEL, "hidden w-80 border-l md:flex")}
          >
            <div className={cn("min-h-0 flex-1 overflow-y-auto", SCROLL)}>
              {selectedWidget ? (
                <Inspector
                  key={selectedWidget.id}
                  widget={selectedWidget}
                  channels={channels}
                  onChange={updateWidget}
                  onRemove={() => removeWidget(selectedWidget.id)}
                  onClose={() => select(null)}
                />
              ) : (
                <p className="text-muted-foreground p-4 text-sm">
                  Select a card to edit its data and props.
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 border-t p-3">
              <Button
                variant={view === "code" ? "default" : "outline"}
                size="sm"
                aria-pressed={view === "code"}
                onClick={() => setView(view === "code" ? "design" : "code")}
              >
                Code
              </Button>
              <CopyButton
                text={() => Promise.resolve(buildStudioPrompt(state, channels))}
                label="Copy prompt"
                variant="outline"
                size="sm"
              >
                Prompt
              </CopyButton>
            </div>
          </aside>
        </div>
      </div>
    </MotionConfig>
  );
}
