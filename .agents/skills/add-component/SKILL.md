---
name: add-component
description: Add a new benchcn component end to end: source under registry/benchcn/ui, registry entry, tests, demo, docs page, verification. Use when asked to build, add or scaffold a component for this registry.
---

# Add a component

Read `AGENTS.md` first. Then follow these steps in order; do not skip the docs page or the tests.

## 1. Source

Create `registry/benchcn/ui/<name>/<name>.tsx`.

- First line: `// benchcn.dev · <name>` (the registry build enforces this).
- Named exports. Where composition helps, export parts (`Scope.Root`, `Scope.Trace`) and a batteries-included component with the plain name.
- Props in plain English: `value`, `unit`, `min`, `max`, `thresholds`, `channels`, `color`, `onCommand`, `confirmed`, `className`. Spread the rest onto the root element.
- Chrome uses shadcn tokens (`bg-card`, `border-border`, `text-muted-foreground`). Channels use `text-chart-1` to `text-chart-5` or `var(--chart-n)`. Physical colours take a `color` prop with presets `red | amber | green | blue | white` defaulting to `var(--primary)`.
- Import other registry files as `@/registry/benchcn/lib/...` or `@/registry/benchcn/hooks/...`; import shadcn wrappers from `@/components/ui/<x>` and list them in `registryDependencies`.
- Low-frequency visuals: SVG. High-frequency: Canvas 2D with `devicePixelRatio`, drawn from a `requestAnimationFrame` loop that stops when the element is offscreen or `prefers-reduced-motion` is set.
- Accessibility: a role and label, keyboard support for anything interactive, and a text alternative (`aria-live` or visually hidden text) for visual readouts.
- Must render usefully with no props beyond what the mock device provides.

## 2. Registry entry

Add to `registry/registry.ts`:

```ts
{
  name: "<name>",
  type: "registry:ui",
  title: "<Title>",
  description: "<one sentence an agent can match against a request>",
  files: [{ path: "registry/benchcn/ui/<name>/<name>.tsx", type: "registry:ui" }],
  dependencies: [],
  registryDependencies: [`${ns}/tokens`, `${ns}/mock-device`],
  categories: ["displays" | "signals" | "readouts" | "controls" | "board" | "comms"],
  docs: docsUrl("components/<name>"),
}
```

## 3. Tests

Pure logic (measurements, decoding, formatting, geometry) lives in a sibling module and gets `<module>.test.ts` with `// #given`, `// #when`, `// #then` comments and one logical assertion per test.

## 4. Demo

`src/components/demos/<name>-demo.tsx`: a self-contained demo bound to `useMockDevice()`. The docs page and the landing bench both import it.

## 5. Docs page

Run the `write-docs-page` skill, or copy `content/docs/components/_template.mdx` if it exists.

## 6. Verify

```bash
pnpm check
pnpm e2e
pnpm registry:test
```

`registry:test` installs every item into a fresh Vite + shadcn project from the built registry and fails on a missing documented import path, a type error under the template's strict settings, a build error, or any console error or warning while the blocks render. Two files in one item must not share a base name: the CLI rewrites imports by file name.

Open `/docs/components/<name>` in light and dark, at 375 px and 1280 px wide, and with reduced motion enabled. Fix what you see before reporting done.
