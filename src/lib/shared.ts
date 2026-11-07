import { createGetUrl } from "fumadocs-core/source";

import { siteConfig } from "../../config/site";

export const docsRoute = "/docs";
export const docsImageRoute = "/og/docs";

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
  const segments = [...page.slugs, "image.webp"];

  return { segments, url: `${siteConfig.url}${getImageUrl(segments, page.locale)}` };
}
