import { createFileRoute, notFound } from "@tanstack/react-router";
import type { ReactElement } from "react";

import { PlantMonitor } from "@/registry/benchcn/blocks/plant-monitor/plant-monitor";
import { WeatherStation } from "@/registry/benchcn/blocks/weather-station/weather-station";

const BLOCKS = {
  "plant-monitor": PlantMonitor,
  "weather-station": WeatherStation,
} as const;

export const Route = createFileRoute("/kiosk/$block")({
  component: Kiosk,
  loader: ({ params }) => {
    if (!(params.block in BLOCKS)) throw notFound();
    return { block: params.block as keyof typeof BLOCKS };
  },
  head: () => ({ meta: [{ name: "robots", content: "noindex" }] }),
});

/** Full-screen kiosk rendering of a block, for an 800×480 touchscreen on the device itself. */
function Kiosk(): ReactElement {
  const { block } = Route.useLoaderData();
  const Block = BLOCKS[block];
  return (
    <div className="bg-background flex min-h-dvh items-center justify-center">
      <Block layout="kiosk" />
    </div>
  );
}
