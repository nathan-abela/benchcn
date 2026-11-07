import { createFileRoute } from "@tanstack/react-router";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import type { ReactElement } from "react";

import { ActuatorControlDemo } from "@/components/demos/actuator-control-demo";
import { LogicAnalyzerDemo } from "@/components/demos/logic-analyzer-demo";
import { OscilloscopeDemo } from "@/components/demos/oscilloscope-demo";
import { baseOptions } from "@/lib/layout.shared";

export const Route = createFileRoute("/spike")({
  component: Spike,
  head: () => ({
    meta: [{ title: "Design spike — benchcn" }, { name: "robots", content: "noindex" }],
  }),
});

function Spike(): ReactElement {
  return (
    <HomeLayout {...baseOptions()}>
      <main className="mx-auto w-full max-w-6xl px-4 py-10 md:px-6">
        <p className="text-muted-foreground mb-2 font-mono text-[11px] tracking-[0.12em] uppercase">
          Design spike · phase 3
        </p>
        <h1 className="mb-8 text-2xl font-medium tracking-tight">Three instruments, one bench</h1>
        <div className="grid items-start gap-6 lg:grid-cols-[3fr_2fr]">
          <OscilloscopeDemo />
          <ActuatorControlDemo />
          <div className="lg:col-span-2">
            <LogicAnalyzerDemo />
          </div>
        </div>
      </main>
    </HomeLayout>
  );
}
