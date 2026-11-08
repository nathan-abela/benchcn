import { DynamicCodeBlock } from "fumadocs-ui/components/dynamic-codeblock";
import { type ReactElement, Suspense, useId, useState } from "react";

import { demos, publicSource } from "@/components/demos";
import { OpenInV0 } from "@/components/site/open-in-v0";
import { Placeholder } from "@/components/site/placeholder";
import { cn } from "@/lib/utils";

export type ComponentPreviewProps = {
  name: string;
  className?: string;
};

const VIEWS = ["Preview", "Code"] as const;
type View = (typeof VIEWS)[number];

/** A live demo in a frame, with its source one tab away and the v0 handoff beside the tabs. */
export function ComponentPreview({ name, className }: ComponentPreviewProps): ReactElement {
  const [view, setView] = useState<View>("Preview");
  const id = useId();
  const demo = demos[name];
  if (!demo) {
    return <p className="text-destructive text-sm">No demo registered for “{name}”.</p>;
  }
  const Demo = demo.component;

  return (
    <div
      data-slot="component-preview"
      className={cn("not-prose bg-card overflow-hidden rounded-xl border", className)}
    >
      <div className="flex items-center justify-between gap-3 px-3 py-2">
        <div
          role="tablist"
          aria-label="Preview or code"
          className="bg-muted/60 inline-flex rounded-lg p-0.5"
        >
          {VIEWS.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              id={`${id}-${item}`}
              aria-selected={view === item}
              aria-controls={`${id}-panel`}
              onClick={() => setView(item)}
              className={cn(
                "focus-visible:ring-ring/50 rounded-md px-3 py-1 text-sm transition-[color,background-color,transform] duration-150 ease-out outline-none focus-visible:ring-[3px] active:scale-[0.97]",
                view === item
                  ? "bg-background text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item}
            </button>
          ))}
        </div>
        <OpenInV0 item={name} />
      </div>
      <div
        id={`${id}-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-${view}`}
        className={cn(
          "bg-background border-t",
          view === "Preview" && "p-4 sm:p-6",
          view === "Code" && "[&_figure]:my-0 [&_figure]:rounded-none [&_figure]:border-0",
        )}
      >
        {view === "Preview" ? (
          <Suspense fallback={<Placeholder heights={demo.placeholder} />}>
            <Demo />
          </Suspense>
        ) : (
          <DynamicCodeBlock lang="tsx" code={publicSource(demo.source)} />
        )}
      </div>
    </div>
  );
}
