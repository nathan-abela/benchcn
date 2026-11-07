import type { ReactElement } from "react";

import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";

import { siteConfig } from "../../../config/site";

export function OpenInV0({ item }: { item: string }): ReactElement {
  const itemUrl = siteConfig.registry.itemUrlTemplate.replace("{name}", item);
  const href = `https://v0.app/chat/api/open?url=${encodeURIComponent(itemUrl)}`;
  return (
    <Button
      variant="ghost"
      size="xs"
      render={<a href={href} target="_blank" rel="noreferrer" aria-label="Open in v0" />}
      onClick={() => track("open_in_v0", { item })}
    >
      Open in v0
    </Button>
  );
}
