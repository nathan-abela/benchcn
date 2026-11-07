import { createFileRoute, Link } from "@tanstack/react-router";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import type { ReactElement, ReactNode } from "react";

import { buildAgentPrompt } from "@/components/site/agent-prompt";
import { Bench } from "@/components/site/bench";
import { ComponentGrid } from "@/components/site/component-grid";
import { CopyButton } from "@/components/site/copy-button";
import { InstallCommand } from "@/components/site/install-command";
import { Mark } from "@/components/site/logo";
import { ScenarioTabs } from "@/components/site/scenario-tabs";
import { ThemeChips } from "@/components/site/theme-chips";
import { track } from "@/lib/analytics";
import { baseOptions } from "@/lib/layout.shared";

import { siteConfig } from "../../config/site";

export const Route = createFileRoute("/")({
  component: Home,
});

const INSTALL = `pnpm dlx shadcn@latest add ${siteConfig.registry.namespace}/plant-monitor`;
const SKILL = `npx skills add ${siteConfig.repo.owner}/${siteConfig.repo.name} -s benchcn`;

function Section({
  id,
  eyebrow,
  title,
  lede,
  children,
  className,
}: {
  id: string;
  eyebrow: string;
  title: string;
  lede?: ReactNode;
  children: ReactNode;
  className?: string;
}): ReactElement {
  return (
    <section id={id} className={className}>
      <div className="mx-auto w-full max-w-6xl border-t px-4 pt-16 pb-20 md:px-6 lg:pt-20 lg:pb-24">
        <div className="mb-10 flex max-w-2xl flex-col gap-3">
          <span className="text-muted-foreground font-mono text-[11px] tracking-[0.14em] uppercase">
            {eyebrow}
          </span>
          <h2 className="text-2xl font-medium tracking-tight sm:text-3xl">{title}</h2>
          {lede ? <p className="text-muted-foreground text-base sm:text-lg">{lede}</p> : null}
        </div>
        {children}
      </div>
    </section>
  );
}

function Home(): ReactElement {
  return (
    <HomeLayout {...baseOptions()}>
      <main className="flex flex-col">
        <section className="mx-auto grid w-full max-w-6xl items-start gap-10 px-4 pt-14 pb-16 md:px-6 lg:grid-cols-12 lg:gap-12 lg:pt-20 lg:pb-24">
          <div className="flex min-w-0 flex-col gap-6 lg:sticky lg:top-24 lg:col-span-5">
            <span className="text-success inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.14em] uppercase">
              <span aria-hidden className="bg-success size-1.5 animate-pulse rounded-full" />
              Everything here is live
            </span>
            <h1 className="text-4xl font-medium tracking-tight text-balance sm:text-5xl">
              {siteConfig.tagline}
            </h1>
            <p className="text-muted-foreground max-w-md text-lg text-pretty">
              Instruments that work, not instruments that look like it. Copy-paste React components
              built the shadcn way, live against a mock device, ready for your ESP32, Pico or
              Raspberry Pi.
            </p>
            <InstallCommand command={INSTALL} item="plant-monitor" />
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <Link
                to="/docs/$"
                params={{ _splat: "" }}
                className="bg-foreground text-background inline-flex h-9 items-center rounded-lg px-4 font-medium"
              >
                Read the docs
              </Link>
              <a href="#components" className="text-muted-foreground hover:text-foreground">
                Browse components ↓
              </a>
            </div>
            <p className="text-muted-foreground font-mono text-[11px] tracking-wide uppercase">
              MIT · Base UI · Tailwind v4 · No runtime CDN
            </p>
            <ThemeChips />
          </div>
          <div className="min-w-0 lg:col-span-7">
            <Bench />
          </div>
        </section>

        <Section
          id="scenarios"
          eyebrow="Scenarios"
          title="One registry, five benches"
          lede="Every scenario runs on the same mock device and the same components. Hold the pump, zoom the analyzer, add a wiring mistake."
        >
          <ScenarioTabs />
        </Section>

        <Section
          id="how"
          eyebrow="How it works"
          title="Mock first, then one line to real hardware"
          lede="Components never open connections. A source does, and every source speaks the same tiny protocol."
        >
          <ol className="grid gap-4 *:min-w-0 lg:grid-cols-3">
            <Step n={1} title="Install what you need">
              <code>{`pnpm dlx shadcn@latest add ${siteConfig.registry.namespace}/sensor-tile`}</code>
            </Step>
            <Step n={2} title="Build against the mock">
              <code>{`const { readings, command } = useMockDevice();`}</code>
            </Step>
            <Step n={3} title="Point it at the device">
              <code>{`const { readings, command } = useWebSocketSource("ws://plant.local/ws");`}</code>
            </Step>
          </ol>
          <div className="bg-card mt-6 rounded-xl border p-4 font-mono text-xs leading-relaxed shadow-[inset_0_1px_0_0_rgb(255_255_255/0.04)] sm:text-sm">
            <p className="text-muted-foreground mb-2 text-[11px] tracking-[0.12em] uppercase">
              benchcn/0 · what the firmware prints
            </p>
            <pre className="overflow-x-auto">{`{"ch":"soil","v":42,"u":"%","t":1731000000}
{"cmd":"set","n":17,"id":"pump","v":true}
{"ack":17,"ok":true,"id":"pump","v":true}`}</pre>
            <p className="text-muted-foreground mt-3 text-xs">
              Plain text lines show up as logs, so <code>print()</code> debugging keeps working.{" "}
              <Link
                to="/docs/$"
                params={{ _splat: "wire-protocol" }}
                className="underline underline-offset-4"
              >
                Wire protocol
              </Link>
            </p>
          </div>
        </Section>

        <Section
          id="components"
          eyebrow="Components"
          title="Eleven instruments, two dashboards"
          lede="Each page has a live preview, the install command, the API and a prompt for your assistant."
        >
          <ComponentGrid />
        </Section>

        <Section
          id="agents"
          eyebrow="For you and your assistant"
          title="Readable by people, usable by agents"
          lede="Every page has a Markdown twin, the site serves llms.txt, and a skill teaches an assistant which component and source to reach for."
        >
          <div className="grid gap-4 *:min-w-0 lg:grid-cols-2">
            <div className="bg-card flex flex-col gap-3 rounded-xl border p-4 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.04)]">
              <span className="text-muted-foreground font-mono text-[11px] tracking-[0.12em] uppercase">
                Install the skill
              </span>
              <InstallCommand
                command={SKILL}
                item="skill"
                className="border-0 bg-transparent px-0 shadow-none"
              />
              <p className="text-muted-foreground text-sm">
                Works with Claude Code, Cursor, Codex and anything else that reads{" "}
                <code>.agents/skills</code>.
              </p>
            </div>
            <div className="bg-card flex flex-col gap-3 rounded-xl border p-4 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.04)]">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground font-mono text-[11px] tracking-[0.12em] uppercase">
                  Or paste a prompt
                </span>
                <CopyButton
                  text={buildAgentPrompt(
                    "plant-monitor",
                    "Build a dashboard for my ESP32 plant monitor: soil, temperature, humidity and a pump with a 2 s acknowledgement timeout.",
                  )}
                  label="Copy prompt"
                  variant="outline"
                  size="xs"
                  onCopied={() => track("copy_agent_prompt", { item: "landing" })}
                >
                  Copy prompt
                </CopyButton>
              </div>
              <p className="text-sm">
                “Build a dashboard for my ESP32 plant monitor using the @benchcn registry: soil,
                temperature, humidity and a pump with a 2 s acknowledgement timeout.”
              </p>
              <p className="text-muted-foreground text-sm">
                <a
                  href={`${siteConfig.basepath}/llms.txt`}
                  className="underline underline-offset-4"
                >
                  llms.txt
                </a>{" "}
                ·{" "}
                <a
                  href={`${siteConfig.basepath}/llms-full.txt`}
                  className="underline underline-offset-4"
                >
                  llms-full.txt
                </a>
              </p>
            </div>
          </div>
        </Section>

        <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 border-t px-4 py-8 md:px-6">
          <span className="inline-flex items-center gap-2 font-mono text-sm">
            <Mark className="size-4" /> {siteConfig.name}
          </span>
          <p className="text-muted-foreground text-xs">
            {siteConfig.license} licensed. Board pinouts are typed from the official datasheets
            cited in each data file.
          </p>
          <a
            href={siteConfig.repo.url}
            className="text-muted-foreground hover:text-foreground text-sm"
          >
            GitHub ↗
          </a>
        </footer>
      </main>
    </HomeLayout>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: ReactNode;
}): ReactElement {
  return (
    <li className="bg-card flex min-w-0 flex-col gap-3 rounded-xl border p-4 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.04)]">
      <span className="text-muted-foreground font-mono text-[11px] tracking-[0.12em] uppercase">
        Step {n}
      </span>
      <span className="text-sm font-medium">{title}</span>
      <div className="bg-background overflow-x-auto rounded-md border px-3 py-2 font-mono text-xs whitespace-nowrap">
        {children}
      </div>
    </li>
  );
}
