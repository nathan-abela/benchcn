// benchcn.dev · connection-status
// A source's link state as people need to read it: whether it is up, how many tries it has taken
// to get back, and whether messages are still arriving while it claims to be open.

/** The same values as `SourceStatus` from the source hooks. */
export type LinkStatus = "idle" | "connecting" | "open" | "closed" | "error" | "unsupported";

/** `stale` is an open link that has gone quiet for longer than `staleAfter`. */
export type ConnectionState = LinkStatus | "stale";

export type ConnectionTrack = {
  status: LinkStatus;
  received: number;
  /** Connection attempts since the link was last open. */
  attempts: number;
  lastMessageAt: number | null;
  openedAt: number | null;
};

/**
 * Folds one observation of a source into the running track. Counting attempts here, rather than
 * asking the transport, works for every hook that reports a status.
 */
export function trackConnection(
  previous: ConnectionTrack | null,
  status: LinkStatus,
  received: number,
  now: number,
): ConnectionTrack {
  const wasOpen = previous?.status === "open";
  const attempts =
    status === "open"
      ? 0
      : status === "connecting" && previous?.status !== "connecting"
        ? (previous?.attempts ?? 0) + 1
        : (previous?.attempts ?? 0);
  const lastMessageAt =
    previous && received === previous.received ? previous.lastMessageAt : received > 0 ? now : null;
  const openedAt = status === "open" ? (wasOpen ? (previous?.openedAt ?? now) : now) : null;
  return { status, received, attempts, lastMessageAt, openedAt };
}

export function connectionState(
  track: Pick<ConnectionTrack, "status" | "lastMessageAt" | "openedAt">,
  now: number,
  staleAfter: number,
): ConnectionState {
  if (track.status !== "open") return track.status;
  // A link that opened and never spoke goes stale too, counted from when it opened.
  const heard = Math.max(track.lastMessageAt ?? Number.NEGATIVE_INFINITY, track.openedAt ?? now);
  return now - heard > staleAfter ? "stale" : "open";
}

export function formatAge(ms: number): string {
  if (ms < 60_000) return `${Math.max(0, Math.floor(ms / 1000))} s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)} min ago`;
  return `${Math.floor(ms / 3_600_000)} h ago`;
}

/**
 * The short text after the state: the attempt number while retrying, otherwise the age of the
 * last message once it is old enough to matter.
 */
export function connectionDetail(
  state: ConnectionState,
  attempts: number,
  lastMessageAt: number | null,
  now: number,
): string | null {
  if (state === "connecting") return attempts > 1 ? `attempt ${attempts}` : null;
  if (lastMessageAt === null) return null;
  const age = now - lastMessageAt;
  return age < 2000 ? null : formatAge(age);
}
