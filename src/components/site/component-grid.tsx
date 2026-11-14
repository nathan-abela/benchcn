import { Link } from "@tanstack/react-router";
import type { ReactElement } from "react";

import { registry } from "@/registry/registry";

import { siteConfig } from "../../../config/site";

export const CATEGORY_LABEL: Record<string, string> = {
  signals: "Signals",
  readouts: "Readouts",
  displays: "Displays",
  controls: "Controls",
  board: "Boards and docs",
  comms: "Comms",
  blocks: "Blocks",
};

/** Most reached-for first. Also the order of the docs sidebar and the catalog page. */
export const CATEGORY_ORDER = [
  "readouts",
  "controls",
  "displays",
  "signals",
  "comms",
  "board",
  "blocks",
];

/** Every installable component and block as one banded list, grouped by category. */
export function ComponentList(): ReactElement {
  const items = registry
    .filter((item) => item.type === "registry:ui" || item.type === "registry:block")
    .sort(
      (a, b) =>
        CATEGORY_ORDER.indexOf(a.categories?.[0] ?? "") -
          CATEGORY_ORDER.indexOf(b.categories?.[0] ?? "") || a.title.localeCompare(b.title),
    );

  return (
    <ul className="flex flex-col gap-1">
      {items.map((item, index) => {
        const path = (item.docs ?? "").replace(siteConfig.url, "");
        const category = item.categories?.[0] ?? "";
        const first = index === 0 || items[index - 1].categories?.[0] !== category;
        return (
          <li key={item.name}>
            <Link
              to={path as "/docs/$"}
              className="group hover:bg-accent odd:bg-muted/50 grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-6 gap-y-1 rounded-lg px-4 py-3 transition-colors sm:grid-cols-[11rem_minmax(0,1fr)_auto] lg:grid-cols-[13rem_minmax(0,1fr)_10rem]"
            >
              <span className="text-sm font-medium">{item.title}</span>
              <span className="text-muted-foreground col-span-2 truncate text-sm sm:col-span-1">
                {item.description}
              </span>
              <span className="text-muted-foreground hidden text-sm lg:block">
                {first ? (CATEGORY_LABEL[category] ?? category) : ""}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
