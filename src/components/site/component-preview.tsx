import { DynamicCodeBlock } from "fumadocs-ui/components/dynamic-codeblock";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import { type ReactElement, Suspense } from "react";

import { demos, publicSource } from "@/components/demos";
import { cn } from "@/lib/utils";

export type ComponentPreviewProps = {
  name: string;
  className?: string;
};

export function ComponentPreview({ name, className }: ComponentPreviewProps): ReactElement {
  const demo = demos[name];
  if (!demo) {
    return <p className="text-destructive text-sm">No demo registered for “{name}”.</p>;
  }
  const Demo = demo.component;

  return (
    <Tabs items={["Preview", "Code"]} className={cn("not-prose", className)}>
      <Tab value="Preview" className="p-4 sm:p-6">
        <Suspense fallback={<div className="bg-muted/40 h-64 animate-pulse rounded-xl" />}>
          <Demo />
        </Suspense>
      </Tab>
      <Tab value="Code" className="p-0">
        <DynamicCodeBlock lang="tsx" code={publicSource(demo.source)} />
      </Tab>
    </Tabs>
  );
}
