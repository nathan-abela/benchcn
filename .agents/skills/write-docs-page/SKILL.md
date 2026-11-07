---
name: write-docs-page
description: Write or update a Fumadocs MDX page for a benchcn component, hook or block, with the required sections (preview, install, usage, props, examples, accessibility, agent prompt). Use when asked to document a component.
---

# Write a docs page

Pages live in `content/docs/components/<name>.mdx`, `content/docs/hooks/<name>.mdx` or `content/docs/blocks/<name>.mdx`. Fumadocs renders them with the components registered in `src/components/mdx.tsx`.

## Frontmatter

```yaml
---
title: <Title>
description: <one sentence, the same one used in registry/registry.ts>
---
```

## Required sections, in this order

1. **Preview**: `<ComponentPreview name="<name>" />` (renders `src/components/demos/<name>-demo.tsx` with a code tab).
2. **Installation**: `<InstallTabs item="<name>" />` (pnpm / npm / yarn / bun, built from `siteConfig`; fires `copy_install_command`).
3. **Usage**: the smallest working snippet against the mock device, then the same snippet with a real source (`useWebSocketSource` or `useSerialSource`).
4. **Anatomy** (composable components only): the part tree.
5. **Props**: `<PropsTable of="<name>" />` or a hand-written table with name, type, default, description. Every prop in the source appears here.
6. **Examples**: two or three focused variants (sizes, colours, error states, reduced data).
7. **Theming**: which tokens the component reads and which `color` presets it offers.
8. **Accessibility**: role, keyboard interactions as a table, what screen readers announce, reduced-motion behaviour.
9. **Ask your agent**: `<AgentPrompt item="<name>" />` (copy button with a ready-made prompt; fires `copy_agent_prompt`).

## Style

- Short sentences, no marketing. Let the preview do the explaining.
- Units and ranges are stated where values appear.
- Where domain data comes from a datasheet, link it.
- Markdown of the page is served at `/docs/.../<name>.md`; keep headings meaningful because `llms-full.txt` is built from them.

After writing, add the page to `content/docs/<section>/meta.json` if that section orders pages by hand, then run `pnpm build` and open the page in both colour schemes.
