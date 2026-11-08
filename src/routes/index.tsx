import { createFileRoute, Link } from "@tanstack/react-router";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import type { ReactElement, ReactNode } from "react";

import { buildAgentPrompt } from "@/components/site/agent-prompt";
import { Bench } from "@/components/site/bench";
import { ComponentList } from "@/components/site/component-grid";
import { CopyButton } from "@/components/site/copy-button";
import { InstallCommand } from "@/components/site/install-command";
import { InstallTabs } from "@/components/site/install-tabs";
import { Mark } from "@/components/site/logo";
import { ScenarioTabs } from "@/components/site/scenario-tabs";
import { ThemeChips } from "@/components/site/theme-chips";
import { track } from "@/lib/analytics";
import { baseOptions } from "@/lib/layout.shared";

import { siteConfig } from "../../config/site";

export const Route = createFileRoute("/")({
  component: Home,
});

const SKILL = `npx skills add ${siteConfig.repo.owner}/${siteConfig.repo.name} -s benchcn`;

function Section({
  id,
  title,
  lede,
  children,
}: {
  id: string;
  title: string;
  lede?: ReactNode;
  children: ReactNode;
}): ReactElement {
  return (
    <section id={id} className="mx-auto w-full max-w-[1400px] px-4 pt-20 pb-4 md:px-6 lg:pt-28">
      <div className="mb-8 flex max-w-2xl flex-col gap-3">
        <h2 className="text-2xl font-medium tracking-tight sm:text-3xl">{title}</h2>
        {lede ? <p className="text-lg text-pretty">{lede}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Home(): ReactElement {
  return (
    <HomeLayout {...baseOptions()}>
      <main className="flex flex-col">
        <section className="mx-auto flex w-full max-w-[1400px] flex-col gap-10 px-4 pt-12 pb-4 md:px-6 lg:pt-16">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 text-center">
            <h1 className="text-[clamp(2.5rem,7vw,3.75rem)] leading-[1] font-medium tracking-[-0.03em] text-balance">
              Hardware UI for shadcn/ui
            </h1>
            <p className="max-w-[52ch] text-lg text-pretty">
              Instruments, displays and controls built the shadcn way. Live against a mock device,
              one line from your ESP32 or Pico.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/docs/$"
                params={{ _splat: "" }}
                className="bg-primary text-primary-foreground inline-flex h-10 items-center rounded-lg px-5 text-sm font-medium transition-transform duration-150 ease-out active:scale-[0.97]"
              >
                Read the docs
              </Link>
              <a
                href={siteConfig.repo.url}
                className="bg-card hover:bg-accent inline-flex h-10 items-center rounded-lg border px-5 text-sm font-medium transition-transform duration-150 ease-out active:scale-[0.97]"
              >
                GitHub
              </a>
            </div>
            <ThemeChips className="mt-1" />
          </div>
          <Bench />
        </section>

        <Section
          id="scenarios"
          title="Five benches, one registry"
          lede="Every scenario runs on the same mock device and the same components. Hold the pump, zoom the analyzer, add a wiring mistake."
        >
          <ScenarioTabs />
        </Section>

        <Section
          id="how"
          title="Mock first, then one line to real hardware"
          lede="Components never open connections. A source does, and every source speaks the same tiny protocol."
        >
          <div className="grid gap-8 *:min-w-0 lg:grid-cols-2 lg:gap-12">
            <ol className="flex flex-col gap-7">
              <Step title="Install what you need">
                <InstallTabs item="sensor-tile" note={false} />
              </Step>
              <Step title="Build against the mock">
                <Code>{`const { readings, command } = useMockDevice();`}</Code>
              </Step>
              <Step title="Point it at the device">
                <Code>{`const { readings, command } = useWebSocketSource("ws://plant.local/ws");`}</Code>
              </Step>
            </ol>
            <div className="bg-card flex flex-col gap-3 self-start rounded-xl border p-4">
              <span className="text-sm font-medium">What the firmware prints</span>
              <pre className="overflow-x-auto font-mono text-xs leading-relaxed sm:text-sm">{`{"ch":"soil","v":42,"u":"%","t":1731000000}
{"cmd":"set","n":17,"id":"pump","v":true}
{"ack":17,"ok":true,"id":"pump","v":true}`}</pre>
              <p className="text-muted-foreground text-sm">
                One JSON object per line. Plain text lines show up as logs, so <code>print()</code>{" "}
                debugging keeps working.{" "}
                <Link
                  to="/docs/$"
                  params={{ _splat: "wire-protocol" }}
                  className="text-foreground underline underline-offset-4"
                >
                  Wire protocol
                </Link>
              </p>
            </div>
          </div>
        </Section>

        <Section
          id="components"
          title="Eleven instruments, two dashboards"
          lede="Each page has a live preview, the install command, the API and a prompt for your assistant."
        >
          <ComponentList />
        </Section>

        <Section
          id="agents"
          title="Readable by people, usable by agents"
          lede="Every page has a Markdown twin, the site serves llms.txt, and a skill teaches an assistant which component and source to reach for."
        >
          <div className="grid gap-3 *:min-w-0 lg:grid-cols-2">
            <div className="bg-card flex flex-col gap-3 rounded-xl border p-4">
              <span className="text-sm font-medium">Install the skill</span>
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
            <div className="bg-card flex flex-col gap-3 rounded-xl border p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">Or paste a prompt</span>
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
                  className="text-foreground underline underline-offset-4"
                >
                  llms.txt
                </a>{" "}
                and{" "}
                <a
                  href={`${siteConfig.basepath}/llms-full.txt`}
                  className="text-foreground underline underline-offset-4"
                >
                  llms-full.txt
                </a>
              </p>
            </div>
          </div>
        </Section>

        <footer className="mx-auto flex w-full max-w-[1400px] flex-wrap items-center justify-between gap-4 px-4 pt-24 pb-10 md:px-6">
          <span className="inline-flex items-center gap-2 text-sm font-medium">
            <Mark className="size-4" /> {siteConfig.name}
          </span>
          <p className="text-muted-foreground text-sm">
            {siteConfig.license} licensed. Board pinouts are typed from the official datasheets
            cited in each data file.
          </p>
          <a href={siteConfig.repo.url} className="text-sm underline-offset-4 hover:underline">
            GitHub
          </a>
        </footer>
      </main>
    </HomeLayout>
  );
}

function Step({ title, children }: { title: string; children: ReactNode }): ReactElement {
  return (
    <li className="flex min-w-0 flex-col gap-3">
      <span className="text-base font-medium">{title}</span>
      {children}
    </li>
  );
}

function Code({ children }: { children: string }): ReactElement {
  return (
    <pre className="bg-card overflow-x-auto rounded-lg border px-4 py-3 font-mono text-xs sm:text-[13px]">
      <code>{children}</code>
    </pre>
  );
}
