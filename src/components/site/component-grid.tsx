import { Link } from "@tanstack/react-router";
import type { ReactElement } from "react";

import { registry } from "@/registry/registry";

import { siteConfig } from "../../../config/site";

const CATEGORY_LABEL: Record<string, string> = {
  signals: "Signals",
  readouts: "Readouts",
  displays: "Displays",
  controls: "Controls",
  board: "Boards and docs",
  comms: "Comms",
  blocks: "Blocks",
};

const ORDER = ["signals", "controls", "readouts", "displays", "comms", "board", "blocks"];

export function ComponentGrid(): ReactElement {
  const items = registry
    .filter((item) => item.type === "registry:ui" || item.type === "registry:block")
    .sort(
      (a, b) =>
        ORDER.indexOf(a.categories?.[0] ?? "") - ORDER.indexOf(b.categories?.[0] ?? "") ||
        a.title.localeCompare(b.title),
    );

  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => {
        const path = (item.docs ?? "").replace(siteConfig.url, "");
        return (
          <li key={item.name}>
            <Link
              to={path as "/docs/$"}
              className="group bg-card hover:border-foreground/30 flex h-full flex-col gap-2 rounded-xl border p-4 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.04)] transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{item.title}</span>
                <span className="text-muted-foreground font-mono text-[10px] tracking-[0.12em] uppercase">
                  {CATEGORY_LABEL[item.categories?.[0] ?? ""] ?? item.categories?.[0]}
                </span>
              </div>
              <p className="text-muted-foreground line-clamp-2 text-sm">{item.description}</p>
              <span className="text-muted-foreground group-hover:text-foreground mt-auto font-mono text-[11px]">
                {siteConfig.registry.namespace}/{item.name} ↗
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
