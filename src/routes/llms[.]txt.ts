import { createFileRoute } from "@tanstack/react-router";

import { absoluteDocsLinks, docsLlms } from "@/lib/source";

export const Route = createFileRoute("/llms.txt")({
  server: {
    handlers: {
      GET: async () => new Response(absoluteDocsLinks(await docsLlms.index())),
    },
  },
});
