import { Link } from "@tanstack/react-router";
import { useSearchContext } from "fumadocs-ui/contexts/search";
import { useTheme } from "fumadocs-ui/provider/base";
import type { ReactElement, ReactNode } from "react";

import { GitHubIcon, MoonIcon, SearchIcon, SunIcon } from "@/components/site/icons";
import { Wordmark } from "@/components/site/logo";
import { cn } from "@/lib/utils";

import { siteConfig } from "../../../config/site";

const TEXT_LINK =
  "text-foreground/75 hover:text-foreground rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors";
const ICON_BUTTON =
  "text-foreground/75 hover:text-foreground hover:bg-accent focus-visible:ring-ring/50 inline-flex size-9 items-center justify-center rounded-lg transition-[color,background-color,transform] duration-150 ease-out outline-none focus-visible:ring-[3px] active:scale-95";

export type SiteNavProps = {
  className?: string;
  /** Rendered last, for a page that needs its own control there, such as the docs menu. */
  menu?: ReactNode;
};

/** Wordmark left; links, search, the repository and the theme switch grouped on the right. */
export function SiteNav({ className, menu }: SiteNavProps): ReactElement {
  const { setOpenSearch } = useSearchContext();
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <header
      className={cn("bg-background/80 sticky top-0 z-40 border-b backdrop-blur-md", className)}
    >
      <nav
        aria-label="Site"
        className="mx-auto flex h-16 w-full max-w-[1400px] items-center justify-between gap-4 px-4 md:px-6"
      >
        <Link
          to="/"
          aria-label={`${siteConfig.name} home`}
          className="flex h-9 shrink-0 items-center"
        >
          <Wordmark />
        </Link>
        <div className="flex items-center gap-1">
          <Link to="/docs/$" params={{ _splat: "" }} className={TEXT_LINK}>
            Docs
          </Link>
          <Link
            to="/docs/$"
            params={{ _splat: "components" }}
            className={`${TEXT_LINK} hidden sm:inline-flex`}
          >
            Components
          </Link>
          <Link to="/studio" className={`${TEXT_LINK} hidden sm:inline-flex`}>
            Studio
          </Link>
          <button
            type="button"
            aria-label="Search"
            onClick={() => setOpenSearch(true)}
            className="text-muted-foreground hover:text-foreground hover:bg-accent focus-visible:ring-ring/50 ml-2 inline-flex h-9 items-center gap-2 rounded-lg border px-2.5 text-sm transition-colors outline-none focus-visible:ring-[3px] sm:px-3"
          >
            <SearchIcon />
            <span className="hidden items-center gap-1 sm:inline-flex" aria-hidden>
              <kbd className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-sans text-[11px]">
                Ctrl
              </kbd>
              <kbd className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-sans text-[11px]">
                K
              </kbd>
            </span>
          </button>
          <span aria-hidden className="bg-border mx-2 hidden h-5 w-px sm:block" />
          <a
            href={siteConfig.repo.url}
            aria-label="GitHub repository"
            className={ICON_BUTTON}
            target="_blank"
            rel="noreferrer"
          >
            <GitHubIcon />
          </a>
          <button
            type="button"
            aria-label="Toggle theme"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            className={ICON_BUTTON}
          >
            <SunIcon className="size-4 dark:hidden" />
            <MoonIcon className="hidden size-4 dark:block" />
          </button>
          {menu}
        </div>
      </nav>
    </header>
  );
}
