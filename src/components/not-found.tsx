import { Link } from "@tanstack/react-router";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import type { ReactElement } from "react";

import { SiteNav } from "@/components/site/site-nav";
import { baseOptions } from "@/lib/layout.shared";
import { cn } from "@/lib/utils";
import { INSTRUMENT_FRAME } from "@/registry/benchcn/lib/instrument";
import { ConnectionStatus } from "@/registry/benchcn/ui/connection-status/connection-status";
import { SevenSegment } from "@/registry/benchcn/ui/seven-segment/seven-segment";
import { SignalStrength } from "@/registry/benchcn/ui/signal-strength/signal-strength";
import { StatusLed } from "@/registry/benchcn/ui/status-led/status-led";

const BUTTON =
  "inline-flex h-10 items-center rounded-lg px-5 text-sm font-medium transition-transform duration-150 ease-out select-none active:scale-[0.97]";

export function NotFound(): ReactElement {
  return (
    <HomeLayout {...baseOptions()} nav={{ component: <SiteNav /> }}>
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <div className={cn(INSTRUMENT_FRAME, "max-w-full gap-4 p-4")}>
          <SevenSegment
            value="404"
            color="red"
            size={168}
            label="404"
            className="[&_svg]:power-on rounded-lg px-7 py-6"
          />
          <div className="flex items-center justify-between gap-4 px-1 text-xs">
            <StatusLed on color="red" size="sm" label="Fault" showLabel />
            <ConnectionStatus status="closed" attempts={3} label="Route" />
            <SignalStrength value={null} label="Signal" showValue />
          </div>
        </div>
        <h1 className="mt-10 text-3xl font-medium tracking-[-0.02em]">Page not found</h1>
        <p className="text-muted-foreground mt-3 max-w-[44ch] text-pretty">
          Nothing is wired to this address.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link to="/" className={cn(BUTTON, "bg-primary text-primary-foreground")}>
            Go home
          </Link>
          <Link
            to="/docs/$"
            params={{ _splat: "components" }}
            className={cn(BUTTON, "bg-card hover:bg-accent border")}
          >
            Browse components
          </Link>
        </div>
      </main>
    </HomeLayout>
  );
}
