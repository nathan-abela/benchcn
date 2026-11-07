import { createFileRoute, Link } from "@tanstack/react-router";
import { HomeLayout } from "fumadocs-ui/layouts/home";

import { baseOptions } from "@/lib/layout.shared";

import { siteConfig } from "../../config/site";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <HomeLayout {...baseOptions()}>
      <div className="flex flex-1 flex-col justify-center px-4 py-8 text-center">
        <p className="text-muted-foreground mb-3 font-mono text-xs tracking-wider uppercase">
          Everything here is live
        </p>
        <h1 className="mb-4 text-3xl font-medium tracking-tight">{siteConfig.tagline}</h1>
        <p className="text-muted-foreground mx-auto mb-8 max-w-xl">{siteConfig.description}</p>
        <Link
          to="/docs/$"
          params={{ _splat: "" }}
          className="bg-primary text-primary-foreground mx-auto rounded-lg px-3 py-2 text-sm font-medium"
        >
          Read the docs
        </Link>
      </div>
    </HomeLayout>
  );
}
