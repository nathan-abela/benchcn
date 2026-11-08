import { Menu } from "@base-ui/react/menu";
import type { ReactElement } from "react";

import { CopyButton } from "@/components/site/copy-button";
import {
  AnthropicIcon,
  ChevronDownIcon,
  GitHubIcon,
  MarkdownIcon,
  OpenAiIcon,
} from "@/components/site/icons";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";

export type PageActionsProps = {
  /** Absolute URL of the page's Markdown twin. */
  markdownUrl: string;
  githubUrl: string;
};

/**
 * Copy the page as Markdown, with the other ways to take it elsewhere behind a split menu.
 * Uses the Base UI menu directly because the project ships no shadcn dropdown wrapper.
 */
export function PageActions({ markdownUrl, githubUrl }: PageActionsProps): ReactElement {
  const prompt = `Read ${markdownUrl} and help me use this on my own project.`;
  const items = [
    { label: "View as Markdown", href: markdownUrl, external: false, icon: MarkdownIcon },
    {
      label: "Open in Claude",
      href: `https://claude.ai/new?${new URLSearchParams({ q: prompt })}`,
      external: true,
      icon: AnthropicIcon,
    },
    {
      label: "Open in ChatGPT",
      href: `https://chatgpt.com/?${new URLSearchParams({ hints: "search", q: prompt })}`,
      external: true,
      icon: OpenAiIcon,
    },
    { label: "Edit on GitHub", href: githubUrl, external: true, icon: GitHubIcon },
  ];

  return (
    <div className="-mt-4 flex items-center border-b pb-6">
      <CopyButton
        text={async () => {
          const response = await fetch(markdownUrl);
          if (!response.ok) throw new Error(`Failed to fetch ${markdownUrl}: ${response.status}`);
          return response.text();
        }}
        label="Copy page as Markdown"
        variant="outline"
        size="sm"
        className="rounded-r-none"
        onCopied={() => track("copy_markdown", { url: markdownUrl })}
      >
        Copy Markdown
      </CopyButton>
      <Menu.Root>
        <Menu.Trigger
          render={
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="More page actions"
              className="-ml-px rounded-l-none"
            />
          }
        >
          <ChevronDownIcon className="size-3.5" />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner align="start" sideOffset={6}>
            <Menu.Popup className="bg-popover text-popover-foreground min-w-44 origin-(--transform-origin) rounded-lg border p-1 shadow-md transition-[opacity,scale] duration-150 ease-out outline-none data-ending-style:scale-[0.97] data-ending-style:opacity-0 data-starting-style:scale-[0.97] data-starting-style:opacity-0">
              {items.map((item) => (
                <Menu.LinkItem
                  key={item.label}
                  href={item.href}
                  target={item.external ? "_blank" : undefined}
                  rel={item.external ? "noreferrer" : undefined}
                  className="data-highlighted:bg-accent data-highlighted:text-accent-foreground flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm outline-none select-none"
                >
                  <item.icon className="text-muted-foreground size-4" />
                  {item.label}
                </Menu.LinkItem>
              ))}
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </div>
  );
}
