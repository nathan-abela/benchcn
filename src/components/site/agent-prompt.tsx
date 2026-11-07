import { Children, isValidElement, type ReactElement, type ReactNode } from "react";

import { CopyButton } from "@/components/site/copy-button";
import { track } from "@/lib/analytics";
import { registry } from "@/registry/registry";

import { siteConfig } from "../../../config/site";

export type AgentPromptProps = {
  item: string;
  /** Extra instructions appended to the generic prompt. */
  children?: ReactNode;
};

function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return "";
}

export function buildAgentPrompt(item: string, extra?: string): string {
  const entry = registry.find((r) => r.name === item);
  const title = entry?.title ?? item;
  const docs = entry?.docs ?? `${siteConfig.url}/docs`;
  const lines = [
    `Add the ${title} from the ${siteConfig.registry.namespace} shadcn/ui registry to this project.`,
    "",
    `1. If components.json has no "${siteConfig.registry.namespace}" entry under "registries", add: "${siteConfig.registry.namespace}": "${siteConfig.registry.itemUrlTemplate}"`,
    `2. Run: pnpm dlx shadcn@latest add ${siteConfig.registry.namespace}/${item}`,
    `3. Read ${docs}.md before using it. ${entry?.description ?? ""}`.trimEnd(),
    "4. Start against the mock device (useMockDevice), then switch to useWebSocketSource or useSerialSource when the hardware is ready. Components never open connections themselves.",
    "5. Pass units with values, keep commanded and confirmed state separate for actuators, and respect prefers-reduced-motion.",
  ];
  if (extra?.trim()) lines.push("", extra.trim());
  return lines.join("\n");
}

export function AgentPrompt({ item, children }: AgentPromptProps): ReactElement {
  const prompt = buildAgentPrompt(item, Children.toArray(children).map(textOf).join(" "));
  return (
    <div className="not-prose bg-card relative rounded-xl border">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <span className="text-muted-foreground font-mono text-[11px] tracking-[0.12em] uppercase">
          Prompt for Claude Code, Cursor or Copilot
        </span>
        <CopyButton
          text={prompt}
          label="Copy prompt"
          variant="outline"
          size="xs"
          onCopied={() => track("copy_agent_prompt", { item })}
        >
          Copy prompt
        </CopyButton>
      </div>
      <pre className="overflow-x-auto px-4 py-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
        {prompt}
      </pre>
    </div>
  );
}
