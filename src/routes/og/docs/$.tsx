import { createFileRoute } from "@tanstack/react-router";

import { DocsImage, ogImageResponse } from "@/lib/og";
import { source } from "@/lib/source";

export const Route = createFileRoute("/og/docs/$")({
  server: {
    handlers: {
      GET: ({ params }) => {
        const slugs = (params._splat?.split("/") ?? []).filter((v) => v.length > 0).slice(0, -1);
        const page = source.getPage(slugs);
        if (!page) return new Response(undefined, { status: 404 });

        return ogImageResponse(
          <DocsImage title={page.data.title} description={page.data.description} />,
        );
      },
    },
  },
});
