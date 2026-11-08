import { type ReactElement, useSyncExternalStore } from "react";

import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

export const THEMES = [
  { id: "stone", label: "Stone", swatch: "oklch(0.55 0.015 60)" },
  { id: "zinc", label: "Zinc", swatch: "oklch(0.55 0.01 286)" },
  { id: "neutral", label: "Neutral", swatch: "oklch(0.55 0 0)" },
  { id: "blue", label: "Blue", swatch: "oklch(0.62 0.19 260)" },
  { id: "green", label: "Green", swatch: "oklch(0.63 0.19 149)" },
  { id: "rose", label: "Rose", swatch: "oklch(0.64 0.22 16)" },
  { id: "violet", label: "Violet", swatch: "oklch(0.6 0.22 293)" },
  { id: "orange", label: "Orange", swatch: "oklch(0.7 0.19 48)" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export const THEME_STORAGE_KEY = "benchcn-theme";
const THEME_EVENT = "benchcn-theme";

export function applyTheme(theme: ThemeId): void {
  const root = document.documentElement;
  if (theme === "stone") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage can be unavailable in private windows; the theme still applies for this page.
  }
  window.dispatchEvent(new Event(THEME_EVENT));
}

function subscribeTheme(onChange: () => void): () => void {
  window.addEventListener(THEME_EVENT, onChange);
  return () => window.removeEventListener(THEME_EVENT, onChange);
}

function readTheme(): ThemeId {
  return (document.documentElement.getAttribute("data-theme") as ThemeId | null) ?? "stone";
}

export function useTheme(): ThemeId {
  return useSyncExternalStore(subscribeTheme, readTheme, () => "stone");
}

export function ThemeChips({ className }: { className?: string }): ReactElement {
  const theme = useTheme();

  return (
    <fieldset className={cn("flex items-center gap-2", className)}>
      <legend className="sr-only">Theme</legend>
      {THEMES.map((t) => (
        <button
          key={t.id}
          type="button"
          aria-label={t.label}
          aria-pressed={theme === t.id}
          title={t.label}
          onClick={() => {
            applyTheme(t.id);
            track("select_theme", { theme: t.id });
          }}
          className={cn(
            "focus-visible:ring-ring/50 size-5 rounded-full transition-transform duration-150 ease-out outline-none focus-visible:ring-[3px] active:scale-95",
            theme === t.id &&
              "ring-foreground ring-2 ring-offset-2 ring-offset-[var(--background)]",
          )}
          style={{ background: t.swatch }}
        />
      ))}
    </fieldset>
  );
}
