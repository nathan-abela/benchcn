import { createFileRoute, notFound } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { useFumadocsLoader } from "fumadocs-core/source/client";
import { useSidebar } from "fumadocs-ui/components/sidebar/base";
import { DocsLayout } from "fumadocs-ui/layouts/notebook";
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/layouts/notebook/page";
import { type CSSProperties, type ReactElement, Suspense, use } from "react";

import { useMDXComponents } from "@/components/mdx";
import { MenuIcon } from "@/components/site/icons";
import { PageActions } from "@/components/site/page-actions";
import { SiteNav } from "@/components/site/site-nav";
import { baseOptions } from "@/lib/layout.shared";
import { getPageDataUrl, gitConfig, ogImageMeta } from "@/lib/shared";
import { type DocsPageData, docs, getDocsPageData } from "@/lib/source";

export const Route = createFileRoute("/docs/$")({
  component: Page,
  loader: async ({ params }) => {
    const slugs = params._splat?.split("/").filter(Boolean) ?? [];
    const data = await loadPageData(slugs);
    if (!data) throw notFound();
    await docs.getPage(data.path)?.preload();
    return data;
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? ogImageMeta(loaderData.imageUrl, loaderData.title) : [],
  }),
});

const loadPageData = createIsomorphicFn()
  .server((slugs: string[]) => getDocsPageData(slugs))
  .client(async (slugs: string[]): Promise<DocsPageData | null> => {
    const response = await fetch(getPageDataUrl(slugs));
    return response.ok ? response.json() : null;
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
      <PageActions
        markdownUrl={markdownUrl}
        githubUrl={`https://github.com/${gitConfig.user}/${gitConfig.repo}/blob/${gitConfig.branch}/content/docs/${path}`}
      />
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
    >
      <Suspense>
        <Content path={path} markdownUrl={markdownUrl} />
      </Suspense>
    </DocsLayout>
  );
}
