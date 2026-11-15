import { createFileRoute } from "@tanstack/react-router";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import type { ReactElement } from "react";

import { SiteNav } from "@/components/site/site-nav";
import { Studio } from "@/components/studio/studio";
import { baseOptions } from "@/lib/layout.shared";
import { landingImageUrl, ogImageMeta } from "@/lib/shared";

import { siteConfig } from "../../config/site";

const DESCRIPTION =
  "Arrange benchcn components into a dashboard, bind them to the mock device or a WebSocket, and export the code with one install command.";

export const Route = createFileRoute("/studio")({
  component: StudioPage,
  head: () => ({
    meta: [
      { title: `Studio · ${siteConfig.name}` },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: `Studio · ${siteConfig.name}` },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: `${siteConfig.url}/studio` },
      ...ogImageMeta(landingImageUrl, "An oscilloscope screen showing a sine and a square wave"),
    ],
  }),
});

function StudioPage(): ReactElement {
  return (
    <HomeLayout {...baseOptions()} nav={{ component: <SiteNav /> }}>
      <main className="flex flex-col">
        <h1 className="sr-only">Studio</h1>
        <Studio />
      </main>
    </HomeLayout>
  );
}
