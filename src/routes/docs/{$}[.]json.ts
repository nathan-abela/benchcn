import { createFileRoute, notFound } from "@tanstack/react-router";

import { decodeMarkdownUrl } from "@/lib/shared";
import { getDocsPageData } from "@/lib/source";

export const Route = createFileRoute("/docs/{$}.json")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const data = await getDocsPageData(decodeMarkdownUrl(params._splat?.split("/") ?? []));
        if (!data) throw notFound();

        return Response.json(data);
      },
    },
  },
});
