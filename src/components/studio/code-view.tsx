import { DynamicCodeBlock } from "fumadocs-ui/components/dynamic-codeblock";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import { type ReactElement, useMemo } from "react";

import { CopyButton } from "@/components/site/copy-button";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { generateDashboard, installCommand, PACKAGE_RUNNERS } from "@/lib/studio/codegen";
import type { StudioState } from "@/lib/studio/model";

import { siteConfig } from "../../../config/site";

export function CodeView({ state }: { state: StudioState }): ReactElement {
  const { code, items } = useMemo(() => generateDashboard(state), [state]);

  const download = () => {
    const url = URL.createObjectURL(new Blob([code], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "dashboard.tsx";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <Tabs items={PACKAGE_RUNNERS.map((m) => m.id)} groupId="package-manager" persist>
        {PACKAGE_RUNNERS.map((runner) => {
          const command = installCommand(items, runner.run, siteConfig.registry.namespace);
          return (
            <Tab key={runner.id} value={runner.id} className="p-0">
              <div className="flex items-start gap-2 px-4 py-3 font-mono text-sm">
                <span className="text-muted-foreground select-none">$</span>
                <code className="min-w-0 flex-1 break-words">{command}</code>
                <CopyButton
                  text={command}
                  label="Copy command"
                  onCopied={() =>
                    track("copy_install_command", { item: "studio", packageManager: runner.id })
                  }
                />
              </div>
            </Tab>
          );
        })}
      </Tabs>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-sm">dashboard.tsx</span>
          <Button variant="outline" size="sm" onClick={download}>
            Download
          </Button>
        </div>
        <DynamicCodeBlock lang="tsx" code={code} />
      </div>
    </div>
  );
}
