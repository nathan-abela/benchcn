// benchcn.dev · connection-status
// A source's link state in a line: a dot, the state as a word, the retry count while it
// reconnects and the age of the last message once it is late. An open link that stops talking
// reads Stale, because a socket can stay open long after the device behind it has gone.
import {
  type ComponentProps,
  type ReactElement,
  type ReactNode,
  useEffect,
  useReducer,
} from "react";

import { cn } from "@/lib/utils";
import {
  connectionDetail,
  type ConnectionState,
  connectionState,
  type ConnectionTrack,
  type LinkStatus,
  trackConnection,
} from "@/registry/benchcn/lib/connection";

/** Any source hook's handle fits: `useWebSocketSource`, `useSerialSource`, `useMockDevice`... */
export type ConnectionSource = {
  /** The mock device has no status; it reads as open once it has sent something. */
  status?: LinkStatus;
  received: number;
};

export type ConnectionStatusProps = Omit<ComponentProps<"span">, "children"> & {
  source?: ConnectionSource;
  /** Overrides the source's status. */
  status?: LinkStatus;
  /** Overrides the attempts counted from status changes. */
  attempts?: number;
  /** Milliseconds since the epoch. Overrides the time tracked from `source.received`. */
  lastMessageAt?: number | null;
  /** Milliseconds an open link may stay quiet before it reads Stale. */
  staleAfter?: number;
  /** Shown before the state, and used as the accessible name. */
  label?: ReactNode;
};

const STATE_TEXT: Record<ConnectionState, string> = {
  idle: "Idle",
  connecting: "Connecting",
  open: "Connected",
  stale: "Stale",
  closed: "Disconnected",
  error: "Error",
  unsupported: "Unsupported",
};

const STATE_TONE: Record<ConnectionState, string> = {
  idle: "text-muted-foreground",
  connecting: "text-muted-foreground",
  open: "text-foreground",
  stale: "text-warning",
  closed: "text-muted-foreground",
  error: "text-destructive",
  unsupported: "text-muted-foreground",
};

const SOLID: Partial<Record<ConnectionState, true>> = { open: true, stale: true, error: true };

type Clocked = ConnectionTrack & { now: number };

type Observation = { at: number; status?: LinkStatus; received?: number };

function observe(track: Clocked, { at, status, received }: Observation): Clocked {
  if (status === undefined) return { ...track, now: at };
  return { ...trackConnection(track, status, received ?? track.received, at), now: at };
}

export function ConnectionStatus({
  source,
  status: statusProp,
  attempts: attemptsProp,
  lastMessageAt: lastMessageAtProp,
  staleAfter = 5000,
  label,
  className,
  ...props
}: ConnectionStatusProps): ReactElement {
  const received = source?.received ?? 0;
  const status: LinkStatus =
    statusProp ?? source?.status ?? (source ? (received > 0 ? "open" : "connecting") : "idle");

  const [track, dispatch] = useReducer(observe, null, () => {
    const at = Date.now();
    return { ...trackConnection(null, status, received, at), now: at };
  });

  useEffect(() => {
    dispatch({ at: Date.now(), status, received });
  }, [status, received]);

  const lastMessageAt = lastMessageAtProp === undefined ? track.lastMessageAt : lastMessageAtProp;
  const ticking = lastMessageAt !== null || track.openedAt !== null;
  useEffect(() => {
    if (!ticking) return;
    const timer = window.setInterval(() => dispatch({ at: Date.now() }), 1000);
    return () => window.clearInterval(timer);
  }, [ticking]);

  const attempts = attemptsProp ?? track.attempts;
  const state = connectionState(
    { status, lastMessageAt, openedAt: track.openedAt },
    track.now,
    staleAfter,
  );
  const detail = connectionDetail(state, attempts, lastMessageAt, track.now);

  return (
    <span
      data-slot="connection-status"
      data-state={state}
      className={cn("inline-flex items-center gap-2 align-middle text-sm", className)}
      {...props}
    >
      <svg aria-hidden viewBox="0 0 10 10" className={cn("size-2.5 shrink-0", STATE_TONE[state])}>
        <circle
          cx="5"
          cy="5"
          r={SOLID[state] ? 4.5 : 3.75}
          fill={SOLID[state] ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth={SOLID[state] ? 0 : 1.5}
          className={cn(state === "connecting" && "motion-safe:animate-pulse")}
        />
      </svg>
      {label ? (
        <span aria-hidden className="font-medium">
          {label}
        </span>
      ) : null}
      <output className={STATE_TONE[state]}>
        <span className="sr-only">{label ?? "Connection"}: </span>
        {STATE_TEXT[state]}
      </output>
      {detail ? <span className="text-muted-foreground text-xs tabular-nums">{detail}</span> : null}
    </span>
  );
}
