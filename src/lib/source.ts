import { llms, loader } from "fumadocs-core/source";
import { lucideIconsPlugin } from "fumadocs-core/source/lucide-icons";
import { defineDocs } from "fumadocs-mdx/macro";

import { siteConfig } from "../../config/site";
import { docsRoute } from "./shared";

export const docs = defineDocs({
  dir: "content/docs",
  docs: {
    async: true,
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
});

export const source = loader({
  source: docs.toFumadocsSource(),
  baseUrl: docsRoute,
  plugins: [lucideIconsPlugin()],
});

export const docsLlms = llms(source, {
  renderPage: async (page) => `# ${page.data.title} (${siteConfig.url}${page.url})

${await page.data.getText("processed")}`,
});

/** llms.txt links are site-relative; make them absolute so agents can fetch them from anywhere. */
export const absoluteDocsLinks = (text: string): string =>
  text.replaceAll("](/docs", `](${siteConfig.url}/docs`);
