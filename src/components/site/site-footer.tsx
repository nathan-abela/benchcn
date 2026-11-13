import { Link } from "@tanstack/react-router";
import type { ReactElement } from "react";

import { CATEGORY_LABEL, CATEGORY_ORDER } from "@/components/site/component-grid";
import { Wordmark } from "@/components/site/logo";
import { StatusLed } from "@/registry/benchcn/ui/status-led/status-led";
import { registry } from "@/registry/registry";

import { siteConfig } from "../../../config/site";

type FooterLink = { label: string; docs?: string; hash?: string; href?: string };

const DOCS: FooterLink[] = [
  { label: "Introduction", docs: "" },
  { label: "Installation", docs: "installation" },
  { label: "Data sources", docs: "data-sources" },
  { label: "Wire protocol", docs: "wire-protocol" },
  { label: "Theming", docs: "theming" },
];

const RESOURCES: FooterLink[] = [
  { label: "GitHub", href: siteConfig.repo.url },
  { label: "llms.txt", href: `${siteConfig.basepath}/llms.txt` },
  { label: "llms-full.txt", href: `${siteConfig.basepath}/llms-full.txt` },
];

// The catalog grows with every component, so the footer links to its sections, not to each page.
const COMPONENTS: FooterLink[] = [
  { label: "All components", docs: "components" },
  ...CATEGORY_ORDER.filter((category) => category !== "blocks").map((category) => {
    const label = CATEGORY_LABEL[category];
    return { label, docs: "components", hash: label.toLowerCase().replaceAll(" ", "-") };
  }),
];

const BLOCKS: FooterLink[] = registry
  .filter((item) => item.type === "registry:block")
  .map((item) => ({
    label: item.title,
    docs: (item.docs ?? "").replace(`${siteConfig.url}/docs/`, ""),
  }))
  .sort((a, b) => a.label.localeCompare(b.label));

const LINK_CLASS = "text-muted-foreground hover:text-foreground text-sm transition-colors";

function Column({ title, links }: { title: string; links: FooterLink[] }): ReactElement {
  return (
    <div className="flex flex-col gap-4">
      <span className="text-sm font-medium">{title}</span>
      <ul className="flex flex-col gap-2.5">
        {links.map((link) => (
          <li key={link.label}>
            {link.docs !== undefined ? (
              <Link
                to="/docs/$"
                params={{ _splat: link.docs }}
                hash={link.hash}
                className={LINK_CLASS}
              >
                {link.label}
              </Link>
            ) : (
              <a href={link.href} className={LINK_CLASS}>
                {link.label}
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SiteFooter(): ReactElement {
  return (
    <footer className="border-t">
      <div className="mx-auto grid w-full max-w-[1400px] grid-cols-2 gap-x-6 gap-y-12 px-4 py-16 md:px-6 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))] lg:py-20">
        <div className="col-span-2 flex flex-col gap-3 lg:col-span-1">
          <Wordmark />
          <p className="text-muted-foreground max-w-[32ch] text-sm text-pretty">
            Hardware UI for shadcn/ui, live against a mock device until you plug in the real one.
          </p>
        </div>
        <Column title="Docs" links={DOCS} />
        <Column title="Components" links={COMPONENTS} />
        <Column title="Blocks" links={BLOCKS} />
        <Column title="Resources" links={RESOURCES} />
      </div>
      <div className="border-t">
        <div className="text-muted-foreground mx-auto flex w-full max-w-[1400px] flex-wrap items-center justify-between gap-4 px-4 py-6 text-sm md:px-6">
          <p>
            Built by{" "}
            <a href={siteConfig.author.url} className="text-foreground font-medium">
              {siteConfig.author.name}
            </a>
          </p>
          <StatusLed
            label="All instruments live"
            color="green"
            size="sm"
            pattern="heartbeat"
            rate={1}
            showLabel
          />
        </div>
      </div>
    </footer>
  );
}
