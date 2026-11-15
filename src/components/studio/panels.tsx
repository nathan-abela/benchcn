import type { ReactElement } from "react";

import { Button } from "@/components/ui/button";
import { CATALOG, CATALOG_ORDER } from "@/lib/studio/catalog";
import {
  DEFAULT_WEBSOCKET_URL,
  type StudioState,
  type Widget,
  type WidgetType,
} from "@/lib/studio/model";
import { cn } from "@/lib/utils";
import type { SourceHandle } from "@/registry/benchcn/lib/source-store";
import { ConnectionStatus } from "@/registry/benchcn/ui/connection-status/connection-status";

import { nameOf } from "./canvas";
import { FIELD, Section, StudioSelect } from "./fields";
import { usePageProtocol } from "./studio-store";

/** Browsers refuse `ws://` to anything but this machine from an https page. */
export function blockedAsMixedContent(url: string, pageProtocol: string): boolean {
  if (pageProtocol !== "https:" || !url.startsWith("ws://")) return false;
  try {
    const host = new URL(url).hostname;
    return !["localhost", "127.0.0.1", "[::1]"].includes(host) && !host.endsWith(".localhost");
  } catch {
    return false;
  }
}

export function SourcePanel({
  state,
  source,
  connected,
  onSource,
  onConnect,
}: {
  state: StudioState;
  source: SourceHandle;
  connected: string | null;
  onSource: (source: StudioState["source"]) => void;
  onConnect: (url: string | null) => void;
}): ReactElement {
  const protocol = usePageProtocol();
  const url = state.source.kind === "websocket" ? state.source.url : "";
  const blocked = state.source.kind === "websocket" && blockedAsMixedContent(url, protocol);

  return (
    <Section title="Data source">
      <StudioSelect
        label="Data source"
        value={state.source.kind}
        options={[
          { value: "mock", label: "Mock device" },
          { value: "websocket", label: "WebSocket" },
        ]}
        onChange={(next) =>
          onSource(
            next === "websocket"
              ? { kind: "websocket", url: url || DEFAULT_WEBSOCKET_URL }
              : { kind: "mock" },
          )
        }
      />
      {state.source.kind === "websocket" ? (
        <form
          className="flex min-w-0 items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            onConnect(connected ? null : url);
          }}
        >
          <input
            aria-label="WebSocket URL"
            className={cn(FIELD, "font-mono")}
            value={url}
            spellCheck={false}
            disabled={connected !== null}
            onChange={(event) => onSource({ kind: "websocket", url: event.target.value })}
          />
          <Button type="submit" variant="outline" size="sm" disabled={!url.startsWith("ws")}>
            {connected ? "Disconnect" : "Connect"}
          </Button>
        </form>
      ) : null}
      <ConnectionStatus source={source} className="text-sm" />
      {blocked ? (
        <p className="text-warning text-sm">
          This page is https, so the browser blocks ws:// to a network address. Use wss://, a
          localhost address, or run the exported dashboard locally.
        </p>
      ) : null}
    </Section>
  );
}

const ROW =
  "hover:bg-accent focus-visible:ring-ring/50 flex h-8 w-full min-w-0 items-center gap-2 rounded-md px-2 text-left text-sm transition-colors duration-150 outline-none focus-visible:ring-[3px]";

/** The cards on the canvas in order: another way to select one, and to move it from the keyboard. */
export function Layers({
  widgets,
  selected,
  onSelect,
  onMove,
}: {
  widgets: Widget[];
  selected: string | null;
  onSelect: (id: string) => void;
  onMove: (id: string, to: number) => void;
}): ReactElement | null {
  if (widgets.length === 0) return null;
  return (
    <Section title="On the canvas">
      <ol className="-mx-2 flex flex-col">
        {widgets.map((widget, index) => (
          <li key={widget.id}>
            <button
              type="button"
              aria-current={selected === widget.id || undefined}
              aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
              onClick={() => onSelect(widget.id)}
              onKeyDown={(event) => {
                if (!event.altKey) return;
                if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                  event.preventDefault();
                  onMove(widget.id, index + (event.key === "ArrowUp" ? -1 : 1));
                }
              }}
              className={cn(ROW, "aria-current:bg-accent")}
            >
              <span className="min-w-0 flex-1 truncate">{nameOf(widget)}</span>
              <span className="text-muted-foreground shrink-0 text-xs">
                {CATALOG[widget.type].title}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </Section>
  );
}

const GROUPS = ["Readouts", "Controls", "Source"] as const;

export function Palette({ onAdd }: { onAdd: (type: WidgetType) => void }): ReactElement {
  return (
    <>
      {GROUPS.map((group) => (
        <Section key={group} title={group === "Source" ? "Connection" : group}>
          <div className="-mx-2 flex flex-col">
            {CATALOG_ORDER.filter((type) => CATALOG[type].group === group).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => onAdd(type)}
                className={cn(ROW, "active:scale-[0.99]")}
              >
                {CATALOG[type].title}
              </button>
            ))}
          </div>
        </Section>
      ))}
    </>
  );
}
