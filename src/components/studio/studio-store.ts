import { useSyncExternalStore } from "react";

import type { StudioState } from "@/lib/studio/model";
import { DEFAULT_STATE, decodeState, readState, SHARE_PREFIX } from "@/lib/studio/state";

const DRAFT_KEY = "benchcn-studio-draft";

export type StudioSnapshot = {
  state: StudioState;
  /** Set while a shared link is on the canvas; holds the draft it is covering. */
  shared: { draft: StudioState | null } | null;
  /** A shared link is still being decoded. */
  opening: boolean;
};

const SERVER: StudioSnapshot = { state: DEFAULT_STATE, shared: null, opening: false };

function readDraft(): StudioState | null {
  try {
    const text = window.localStorage.getItem(DRAFT_KEY);
    return text ? readState(JSON.parse(text)) : null;
  } catch {
    return null;
  }
}

function writeDraft(state: StudioState): void {
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
  } catch {
    // Private windows and full storage: the layout still works, it just is not kept.
  }
}

export function clearHash(): void {
  if (window.location.hash) {
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }
}

const listeners = new Set<() => void>();
let snapshot: StudioSnapshot | null = null;

function set(next: StudioSnapshot): void {
  snapshot = next;
  if (!next.shared && !next.opening) writeDraft(next.state);
  for (const listener of listeners) listener();
}

function openShared(text: string, draft: StudioState | null): void {
  void decodeState(text).then((layout) => {
    if (layout) {
      set({ state: layout, shared: { draft }, opening: false });
    } else {
      clearHash();
      set({ state: draft ?? DEFAULT_STATE, shared: null, opening: false });
    }
  });
}

// Read on the first client render, so hydration swaps the prerendered layout for the draft
// before paint and a shared link replaces it once decoded.
function load(): StudioSnapshot {
  const draft = readDraft();
  const hash = window.location.hash;
  if (!hash.startsWith(SHARE_PREFIX)) {
    return { state: draft ?? DEFAULT_STATE, shared: null, opening: false };
  }
  openShared(hash.slice(SHARE_PREFIX.length), draft);
  return { state: draft ?? DEFAULT_STATE, shared: null, opening: true };
}

// A link pasted into the address bar of an open Studio only changes the hash.
function onHashChange(): void {
  const hash = window.location.hash;
  if (!hash.startsWith(SHARE_PREFIX)) return;
  const now = getSnapshot();
  openShared(hash.slice(SHARE_PREFIX.length), now.shared ? now.shared.draft : now.state);
}

const getSnapshot = (): StudioSnapshot => (snapshot ??= load());

const subscribe = (listener: () => void) => {
  if (listeners.size === 0) window.addEventListener("hashchange", onHashChange);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("hashchange", onHashChange);
  };
};

export type StudioStore = StudioSnapshot & {
  /** Applies an edit. Editing a shared layout makes it the draft. */
  edit: (change: (state: StudioState) => StudioState) => void;
  openDraft: () => void;
};

export function useStudioStore(): StudioStore {
  const current = useSyncExternalStore(subscribe, getSnapshot, () => SERVER);
  return {
    ...current,
    edit(change) {
      const now = getSnapshot();
      if (now.shared) clearHash();
      set({ state: change(now.state), shared: null, opening: false });
    },
    openDraft() {
      const now = getSnapshot();
      clearHash();
      set({ state: now.shared?.draft ?? now.state, shared: null, opening: false });
    },
  };
}

const noop = () => () => {};

export function usePageProtocol(): string {
  return useSyncExternalStore(
    noop,
    () => window.location.protocol,
    () => "http:",
  );
}
