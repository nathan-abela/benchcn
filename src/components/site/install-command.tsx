import type { ReactElement } from "react";

import { CopyButton } from "@/components/site/copy-button";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

export type InstallCommandProps = {
  command: string;
  item: string;
  className?: string;
};

export function InstallCommand({ command, item, className }: InstallCommandProps): ReactElement {
  return (
    <div
      className={cn(
        "bg-card flex min-w-0 items-center gap-3 rounded-lg border py-2 pr-2 pl-4 font-mono text-xs shadow-[inset_0_1px_0_0_rgb(255_255_255/0.04)] sm:text-[13px]",
        className,
      )}
    >
      <span className="text-muted-foreground select-none">$</span>
      <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap">{command}</code>
      <CopyButton
        text={command}
        label="Copy command"
        variant="secondary"
        size="xs"
        onCopied={() => track("copy_install_command", { item, packageManager: "pnpm" })}
      >
        Copy
      </CopyButton>
    </div>
  );
}
