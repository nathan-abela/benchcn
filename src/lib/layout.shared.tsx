import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

import { Wordmark } from "@/components/site/logo";

import { siteConfig } from "../../config/site";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: <Wordmark />,
      url: "/",
    },
    links: [
      { text: "Docs", url: "/docs", active: "nested-url" },
      { text: "Components", url: "/docs/components", active: "nested-url" },
    ],
    githubUrl: siteConfig.repo.url,
  };
}
