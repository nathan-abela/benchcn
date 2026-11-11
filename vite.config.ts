import { readdirSync } from "node:fs";
import { join } from "node:path";

import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { fumadocsMdx } from "fumadocs-mdx/vite";
import { defineConfig } from "vite";

import { siteConfig } from "./config/site";

function docSlugs(dir: string, prefix: string[] = []): string[][] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) return docSlugs(join(dir, entry.name), [...prefix, entry.name]);
    if (!entry.name.endsWith(".mdx")) return [];
    const slug = entry.name.replace(/\.mdx$/, "");
    return [slug === "index" ? prefix : [...prefix, slug]];
  });
}

const slugs = docSlugs("content/docs");

const markdownPages = slugs.map((s) => ({
  path: `/docs/${s.length === 0 ? "index" : s.join("/")}.md`,
  sitemap: { exclude: true },
}));

const ogPages = slugs.map((s) => ({
  path: `/og/docs/${[...s, "image.png"].join("/")}`,
  sitemap: { exclude: true },
}));

export default defineConfig({
  base: `${siteConfig.basepath}/`,
  server: { port: 3000 },
  plugins: [
    fumadocsMdx(),
    tailwindcss(),
    tanstackStart({
      router: { basepath: siteConfig.basepath },
      sitemap: { host: siteConfig.url },
      prerender: { enabled: true, crawlLinks: true, failOnError: true },
      pages: [
        { path: "/api/search", sitemap: { exclude: true } },
        { path: "/llms.txt", sitemap: { exclude: true } },
        { path: "/llms-full.txt", sitemap: { exclude: true } },
        { path: "/og/image.png", sitemap: { exclude: true } },
        { path: "/kiosk/plant-monitor", sitemap: { exclude: true } },
        { path: "/kiosk/power-bench", sitemap: { exclude: true } },
        { path: "/kiosk/robot", sitemap: { exclude: true } },
        { path: "/kiosk/weather-station", sitemap: { exclude: true } },
        {
          path: "/404",
          prerender: { enabled: true, outputPath: "/404.html" },
          sitemap: { exclude: true },
        },
        ...markdownPages,
        ...ogPages,
      ],
    }),
    react(),
  ],
  resolve: {
    tsconfigPaths: true,
    alias: { tslib: "tslib/tslib.es6.js" },
  },
});
