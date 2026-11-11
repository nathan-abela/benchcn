import { createFileRoute } from "@tanstack/react-router";

import { LandingImage, ogImageResponse } from "@/lib/og";

export const Route = createFileRoute("/og/image.png")({
  server: {
    handlers: {
      GET: () => ogImageResponse(<LandingImage />),
    },
  },
});
