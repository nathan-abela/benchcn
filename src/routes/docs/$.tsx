import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useFumadocsLoader } from "fumadocs-core/source/client";
import { useSidebar } from "fumadocs-ui/components/sidebar/base";
import { DocsLayout } from "fumadocs-ui/layouts/notebook";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
  MarkdownCopyButton,
  ViewOptionsPopover,
} from "fumadocs-ui/layouts/notebook/page";
import { type CSSProperties, type ReactElement, Suspense, use } from "react";

import { useMDXComponents } from "@/components/mdx";
import { MenuIcon } from "@/components/site/icons";
import { SiteNav } from "@/components/site/site-nav";
import { ThemeChips } from "@/components/site/theme-chips";
import { baseOptions } from "@/lib/layout.shared";
import { getPageImageUrl, getPageMarkdownUrl, gitConfig } from "@/lib/shared";
import { docs, source } from "@/lib/source";

export const Route = createFileRoute("/docs/$")({
  component: Page,
  loader: async ({ params }) => {
    const slugs = params._splat?.split("/") ?? [];
    const data = await serverLoader({ data: slugs });
    await docs.getPage(data.path)?.preload();
    return data;
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? [{ property: "og:image", content: loaderData.imageUrl }] : [],
  }),
});

const serverLoader = createServerFn({
  method: "GET",
})
  .validator((slugs: string[]) => slugs)
  .handler(async ({ data: slugs }) => {
    const page = source.getPage(slugs);
    if (!page) throw notFound();

    return {
      path: page.path,
      markdownUrl: getPageMarkdownUrl(page).url,
      imageUrl: getPageImageUrl(page).url,
      pageTree: await source.serializePageTree(source.getPageTree()),
    };
  });

/**
 * The layout's own header is replaced by the site nav, so its height is declared here, and the
 * grid takes the landing's column width so the nav sits in the same place on both pages.
 */
const LAYOUT_STYLE = {
  "--fd-header-height": "4rem",
  "--fd-layout-width": "1400px",
} as CSSProperties;

function Content({ path, markdownUrl }: { path: string; markdownUrl: string }) {
  const page = docs.getPage(path);
  if (!page) throw new Error(`unknown page: ${path}`);

  const { toc } = use(page.load());
  const MDX = page.body;

  return (
    <DocsPage toc={toc}>
      <DocsTitle>{page.title}</DocsTitle>
      <DocsDescription>{page.description}</DocsDescription>
      <div className="-mt-4 flex flex-row items-center gap-2 border-b pb-6">
        <MarkdownCopyButton markdownUrl={markdownUrl} />
        <ViewOptionsPopover
          markdownUrl={markdownUrl}
          githubUrl={`https://github.com/${gitConfig.user}/${gitConfig.repo}/blob/${gitConfig.branch}/content/docs/${path}`}
        />
      </div>
      <DocsBody>
        <MDX components={useMDXComponents()} />
      </DocsBody>
    </DocsPage>
  );
}

function DocsMenuButton(): ReactElement {
  const { setOpen } = useSidebar();
  return (
    <button
      type="button"
      aria-label="Open navigation"
      onClick={() => setOpen(true)}
      className="text-foreground/75 hover:text-foreground hover:bg-accent focus-visible:ring-ring/50 inline-flex size-9 items-center justify-center rounded-lg outline-none focus-visible:ring-[3px] md:hidden"
    >
      <MenuIcon />
    </button>
  );
}

function Page() {
  const { path, pageTree, markdownUrl } = useFumadocsLoader(Route.useLoaderData());

  return (
    <DocsLayout
      {...baseOptions()}
      tree={pageTree}
      nav={{
        mode: "top",
        component: <SiteNav className="[grid-area:header]" menu={<DocsMenuButton />} />,
      }}
      searchToggle={{ enabled: false }}
      themeSwitch={{ enabled: false }}
      containerProps={{ style: LAYOUT_STYLE }}
      sidebar={{
        footer: (
          <div className="px-3 pt-4 pb-2">
            <ThemeChips />
          </div>
        ),
      }}
    >
      <Suspense>
        <Content path={path} markdownUrl={markdownUrl} />
      </Suspense>
    </DocsLayout>
  );
}
