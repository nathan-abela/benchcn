import { createGetUrl } from "fumadocs-core/source";

import { siteConfig } from "../../config/site";

export const docsRoute = "/docs";
export const docsImageRoute = "/og/docs";
export const landingImageUrl = `${siteConfig.url}/og/image.png`;
export const OG_SIZE = { width: 1200, height: 630 } as const;

type MetaTag = { property: string; content: string } | { name: string; content: string };

export function ogImageMeta(url: string, alt: string): MetaTag[] {
  return [
    { property: "og:image", content: url },
    { property: "og:image:type", content: "image/png" },
    { property: "og:image:width", content: String(OG_SIZE.width) },
    { property: "og:image:height", content: String(OG_SIZE.height) },
    { property: "og:image:alt", content: alt },
    { name: "twitter:image", content: url },
  ];
}

export const gitConfig = {
  user: siteConfig.repo.owner,
  repo: siteConfig.repo.name,
  branch: siteConfig.repo.branch,
};

const getDocsUrl = createGetUrl(docsRoute);

export function getPageMarkdownUrl(page: { slugs: string[]; locale?: string }) {
  const segments = [...page.slugs];
  if (segments.length === 0) {
    segments.push("index.md");
  } else {
    segments[segments.length - 1] += ".md";
  }

  return { segments, url: `${siteConfig.basepath}${getDocsUrl(segments, page.locale)}` };
}

/** @returns page slugs */
export function decodeMarkdownUrl(segments: string[]) {
  if (segments.length === 0) return [];

  const out = [...segments];
  out[out.length - 1] = out[out.length - 1].replace(/\.md$/, "");
  if (out.length === 1 && out[0] === "index") out.pop();
  return out;
}

const getImageUrl = createGetUrl(docsImageRoute);

export function getPageImageUrl(page: { slugs: string[]; locale?: string }) {
  const segments = [...page.slugs, "image.png"];

  return { segments, url: `${siteConfig.url}${getImageUrl(segments, page.locale)}` };
}
