// benchcn.dev · serial-console
// Device logs and a command line in one panel: levels, timestamps, follow mode that pauses when
// you scroll up, and a history you can walk with the arrow keys.
import { ArrowDown } from "lucide-react";
import {
  type ComponentProps,
  type FormEvent,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";
import { INSTRUMENT_FRAME, InstrumentLabel } from "@/registry/benchcn/lib/instrument";
import type { WireLogLevel } from "@/registry/benchcn/lib/wire";

export type ConsoleLine = {
  /** Stable key. Falls back to the index when missing. */
  id?: string | number;
  text: string;
  level?: WireLogLevel;
  /** Seconds since the epoch, or since boot when below 1e9. */
  t?: number;
  /** `out` marks lines the dashboard sent. */
  direction?: "in" | "out";
};

export type SerialConsoleProps = ComponentProps<"div"> & {
  lines: ConsoleLine[];
  onCommand?: (line: string) => void;
  title?: ReactNode;
  /** Shown in the header, for example the baud rate or the socket URL. */
  status?: ReactNode;
  timestamps?: boolean;
  /** Levels to show. Defaults to all. */
  levels?: WireLogLevel[];
  placeholder?: string;
  /** Height of the log area. */
  height?: number | string;
  disabled?: boolean;
};

const LEVEL_CLASS: Record<WireLogLevel, string> = {
  debug: "text-muted-foreground/70",
  info: "text-muted-foreground",
  warn: "text-warning",
  error: "text-destructive",
};

export function formatTimestamp(t: number | undefined): string {
  if (t === undefined) return "";
  if (t >= 1e9) {
    const d = new Date(t * 1000);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    const ms = String(d.getMilliseconds()).padStart(3, "0");
    return `${hh}:${mm}:${ss}.${ms}`;
  }
  return `+${t.toFixed(3)}s`;
}

export function SerialConsole({
  lines,
  onCommand,
  title = "Serial console",
  status,
  timestamps = true,
  levels,
  placeholder = "Type a line and press Enter",
  height = 240,
  disabled = false,
  className,
  children,
  ...props
}: SerialConsoleProps): ReactElement {
  const logRef = useRef<HTMLDivElement>(null);
  const [following, setFollowing] = useState(true);
  const [unseen, setUnseen] = useState(0);
  const [draft, setDraft] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const seen = useRef(lines.length);

  const visible = levels ? lines.filter((l) => !l.level || levels.includes(l.level)) : lines;

  useEffect(() => {
    const element = logRef.current;
    if (!element) return;
    if (following) {
      element.scrollTop = element.scrollHeight;
      seen.current = lines.length;
    } else if (lines.length > seen.current) {
      setUnseen(lines.length - seen.current);
    }
  }, [lines, following]);

  const onScroll = () => {
    const element = logRef.current;
    if (!element) return;
    const atBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 8;
    if (atBottom !== following) {
      setFollowing(atBottom);
      if (atBottom) setUnseen(0);
    }
  };

  const jumpToBottom = () => {
    const element = logRef.current;
    if (element) element.scrollTop = element.scrollHeight;
    setFollowing(true);
    setUnseen(0);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const line = draft.trim();
    if (!line || !onCommand || disabled) return;
    onCommand(line);
    setHistory((h) => [...h.filter((x) => x !== line), line].slice(-50));
    setHistoryIndex(null);
    setDraft("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowUp" && history.length > 0) {
      event.preventDefault();
      const next = historyIndex === null ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(next);
      setDraft(history[next]);
    } else if (event.key === "ArrowDown" && historyIndex !== null) {
      event.preventDefault();
      const next = historyIndex + 1;
      if (next >= history.length) {
        setHistoryIndex(null);
        setDraft("");
      } else {
        setHistoryIndex(next);
        setDraft(history[next]);
      }
    } else if (event.key === "Escape") {
      setDraft("");
      setHistoryIndex(null);
    }
  };

  return (
    <div data-slot="serial-console" className={cn(INSTRUMENT_FRAME, "gap-2", className)} {...props}>
      <div className="flex items-center justify-between gap-3">
        <InstrumentLabel>{title}</InstrumentLabel>
        <span className="text-muted-foreground text-xs tabular-nums">
          {status}
          {status ? " · " : ""}
          {visible.length} lines
        </span>
      </div>

      <div className="relative">
        <div
          ref={logRef}
          role="log"
          aria-live="off"
          onScroll={onScroll}
          className="overflow-y-auto rounded-lg border border-black/40 bg-[var(--scope-screen,oklch(0.17_0.004_80))] px-3 py-2 font-mono text-xs leading-5 text-[rgb(255_255_255/0.85)] shadow-[inset_0_2px_8px_rgb(0_0_0/0.4)]"
          style={{ height }}
        >
          {visible.length === 0 ? (
            <p className="text-[rgb(255_255_255/0.4)]">No output yet.</p>
          ) : (
            <ol>
              {visible.map((line, i) => (
                <li
                  key={line.id ?? `${line.t ?? ""}-${i}`}
                  className={cn(
                    "flex gap-3 whitespace-pre-wrap",
                    line.direction === "out" && "text-channel-2",
                  )}
                >
                  {timestamps ? (
                    <span className="shrink-0 text-[rgb(255_255_255/0.35)] tabular-nums">
                      {formatTimestamp(line.t).padStart(12)}
                    </span>
                  ) : null}
                  {line.direction === "out" || line.level ? (
                    <span
                      className={cn(
                        "w-10 shrink-0 uppercase",
                        line.direction === "out"
                          ? "text-channel-2/80"
                          : LEVEL_CLASS[line.level ?? "info"],
                      )}
                    >
                      {line.direction === "out" ? "→" : line.level}
                    </span>
                  ) : null}
                  <span className="min-w-0 break-all">{line.text}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
        {!following ? (
          <button
            type="button"
            onClick={jumpToBottom}
            className="bg-background/90 hover:bg-accent absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs shadow-sm backdrop-blur"
          >
            <ArrowDown className="size-3" />
            {unseen > 0 ? `${unseen} new` : "Follow"}
          </button>
        ) : null}
      </div>

      {onCommand ? (
        <form onSubmit={submit} className="flex items-center gap-2">
          <label className="sr-only" htmlFor="serial-console-input">
            Command
          </label>
          <span className="text-muted-foreground font-mono text-sm select-none">&gt;</span>
          <input
            id="serial-console-input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            autoComplete="off"
            spellCheck={false}
            className="bg-background focus-visible:ring-ring/50 h-9 min-w-0 flex-1 rounded-md border px-3 font-mono text-sm outline-none placeholder:text-xs focus-visible:ring-[3px] disabled:opacity-50"
          />
        </form>
      ) : null}
      {children}
    </div>
  );
}
