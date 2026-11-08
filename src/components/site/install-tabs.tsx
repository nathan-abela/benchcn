import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import type { ReactElement } from "react";

import { CopyButton } from "@/components/site/copy-button";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

import { siteConfig } from "../../../config/site";

const MANAGERS = [
  { id: "pnpm", run: "pnpm dlx" },
  { id: "npm", run: "npx" },
  { id: "yarn", run: "yarn dlx" },
  { id: "bun", run: "bunx --bun" },
] as const;

export type InstallTabsProps = {
  item: string;
  /** Hide the registry note, for example in the hero where the docs are one click away. */
  note?: boolean;
  className?: string;
};

export function InstallTabs({ item, note = true, className }: InstallTabsProps): ReactElement {
  const itemUrl = siteConfig.registry.itemUrlTemplate.replace("{name}", item);

  return (
    <div className={cn("not-prose flex flex-col gap-3", className)}>
      <Tabs items={MANAGERS.map((m) => m.id)} groupId="package-manager" persist>
        {MANAGERS.map((manager) => {
          const command = `${manager.run} shadcn@latest add ${siteConfig.registry.namespace}/${item}`;
          return (
            <Tab key={manager.id} value={manager.id} className="p-0">
              <CommandLine
                command={command}
                onCopied={() => track("copy_install_command", { item, packageManager: manager.id })}
              />
            </Tab>
          );
        })}
      </Tabs>
      {note ? (
        <p className="text-muted-foreground text-sm">
          Needs <code>{siteConfig.registry.namespace}</code> in the <code>registries</code> field of{" "}
          <code>components.json</code>. See{" "}
          <a href="/docs/installation" className="underline underline-offset-4">
            Installation
          </a>
          . Without the namespace, use the item URL directly:{" "}
          <code className="break-all">{itemUrl}</code>
        </p>
      ) : null}
    </div>
  );
}

function CommandLine({
  command,
  onCopied,
}: {
  command: string;
  onCopied: () => void;
}): ReactElement {
  return (
    <div className="flex items-center gap-2 px-4 py-3 font-mono text-sm">
      <span className="text-muted-foreground select-none">$</span>
      <code className="min-w-0 flex-1">{command}</code>
      <CopyButton text={command} label="Copy command" onCopied={onCopied} />
    </div>
  );
}
