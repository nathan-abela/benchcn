# AGENTS.md

benchcn is a shadcn/ui registry of hardware and maker UI components: oscilloscope, logic analyzer, seven-segment and character-LCD displays, GPIO pinout maps, register and timing diagrams, a serial console, and actuator controls that understand commanded vs. confirmed state. Every component is live against a mock device and connects to real hardware through small data-source hooks. Positioning: **instruments that work, not instruments that look like it.**

Out-of-scope work goes to [ROADMAP.md](ROADMAP.md), not into the codebase.

## Commands

| Command                                     | What it does                                                                                                            |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                                  | Vite dev server on port 3000 (`/benchcn/` basepath)                                                                     |
| `pnpm build`                                | `registry:build`, `vite build`, then OG images rewritten as binary, static output in `dist/client`                      |
| `pnpm preview`                              | Serve `dist/client` the way GitHub Pages will (basepath, `404.html`)                                                    |
| `pnpm registry:build`                       | `registry/registry.ts` to `registry.json` to `public/r/*.json`                                                          |
| `pnpm themes:build`                         | Regenerate `src/styles/themes.css` from the shadcn zinc base colour                                                     |
| `pnpm lint` / `pnpm fmt` / `pnpm fmt:check` | oxlint / oxfmt (no ESLint, no Prettier)                                                                                 |
| `pnpm typecheck`                            | `tsc --noEmit` (TypeScript 7)                                                                                           |
| `pnpm test`                                 | Vitest: decoders, wire protocol, ring buffer, mock device, unit maths                                                   |
| `pnpm e2e`                                  | Playwright smoke test against the static build (run `pnpm build` first)                                                 |
| `pnpm registry:test`                        | Installs every item into a fresh Vite + shadcn project, then typechecks, builds and renders it (run `pnpm build` first) |
| `pnpm check`                                | lint, fmt:check, typecheck, test                                                                                        |

Use `pnpm`. `pnpm dlx` is unreliable under pnpm 11 on this machine; use `npx -y <pkg>` for one-off CLIs, and `pnpm exec shadcn` for the registry CLI (it is a dev dependency).

## Folder map

```
config/site.ts            siteConfig: name, url, basepath, registry namespace/URL, repo, author, analytics. Nothing else hard-codes these.
registry/registry.ts      Registry manifest (source of truth for registry.json). One entry per installable item.
registry/benchcn/
  ui/<name>/              Components. Composable parts + a batteries-included default where it helps.
  lib/                    Pure logic: wire.ts (protocol), source-store.ts, actuator.ts (commanded vs. confirmed,
                          booleans and numeric setpoints), alarms.ts, strip-math.ts, ring-buffer.ts,
                          mock-device.ts, decoders/, units.ts
  hooks/                  use-mock-device, use-websocket-source, use-serial-source, use-ring-buffer,
                          use-strip-series, use-alarms, use-pose-trail, use-canvas
  boards/                 Pinout data files, one per board, each with a `source` URL to the official doc
  blocks/                 Full dashboards (power-bench, robot, plant-monitor, weather-station), each with a kiosk layout
src/routes/               TanStack Start file routes: landing, docs/$, kiosk/$block, api/search, llms.txt, og, 404
src/components/site/      Site chrome: nav, install tabs, copy-prompt button, scenario tabs
src/components/demos/     One demo per component, shared by landing and docs
src/styles/               app.css (tokens, fonts), themes.css (generated)
content/docs/             Fumadocs MDX. One page per component, hook and block.
scripts/                  build-registry.mts, build-themes.mts, serve-static.mts, registry-test.mts,
                          write-og-images.mts (Node runs .mts directly)
e2e/                      Playwright
.agents/skills/           Agent skills (agent-agnostic location). benchcn/ is the public skill users install;
                          add-component, write-docs-page and add-board-definition are for contributors;
                          shadcn and migrate-radix-to-base are vendored from shadcn/ui (see skills-lock.json)
evals/                    Realistic agent prompts and results log. Not created yet.
```

## Stack facts that are easy to get wrong

- **TanStack Start 1.169 on Vite 8**, fully prerendered. Static output is `dist/client`. The prerenderer honours `router.basepath` (set from `siteConfig.basepath`), not Vite `base`. API-style routes (`/api/search`, `/llms.txt`, `.md` pages, OG images) are not auto-discovered; `vite.config.ts` lists them in `pages`.
- **Fumadocs 16** with `fumadocs-mdx/vite`. The UI package is the Base UI flavour (`fumadocs-ui` resolves to `@fumadocs/base-ui`). Search is static: `server.staticGET()` plus `useStaticSearch` in `src/components/site/search-dialog.tsx`.
- **shadcn CLI v4**, style `base-nova`, **Base UI** primitives. Components import shadcn wrappers (`@/components/ui/*`) through `registryDependencies`; never import a primitive library directly unless no wrapper exists.
- **Tailwind v4**, CSS-first. Tokens live in `src/styles/app.css` (`@theme inline`) and `themes.css` (generated). benchcn adds `--success` and `--warning`; shadcn does not ship them.
- **oxfmt is 0.x**: pinned exactly. `printWidth` 100, double quotes, sorted imports, Tailwind class sorting on.
- **Hosting is GitHub Pages** under `/benchcn` until the custom domain is attached. The `CNAME` file is ignored for Actions deploys; the domain is set in repo settings.
- No CDN at runtime. Fonts are self-hosted (`@fontsource-variable/geist`, `geist-mono`). Components must not need a web font.

## Conventions

- Every registry source file starts with `// benchcn.dev · <item-name>` (the registry build fails otherwise). This is how public usage is found with GitHub code search.
- Imports inside registry files use `@/registry/benchcn/...`; the shadcn CLI rewrites them to `@/components/ui`, `@/lib`, `@/hooks` on install. Only import from `@/components/ui/*` for shadcn wrappers listed in `registryDependencies`.
- Props are plain, predictable English: `value`, `unit`, `min`, `max`, `thresholds`, `channels`, `color`, `onCommand`, `confirmed`. An agent should be able to guess them.
- Theming has three layers: chrome on shadcn tokens, channels on `--channel-1..4` (falling back to `--chart-1..5`), physical colours on a `color` prop with presets (`red`, `amber`, `green`, `blue`, `white`) defaulting to `--primary`.
- Rendering: SVG for static and low-frequency components; Canvas 2D with devicePixelRatio handling for the scope, logic analyzer and strip charts. No chart libraries.
- Motion: `motion/react` for UI motion, `requestAnimationFrame` loops for instruments, always gated on `prefers-reduced-motion`.
- Keep comments to the why. No commented-out code.
- No em dashes anywhere: UI, docs, comments, commit messages. Empty readouts show `--`.
- Named exports. Explicit return types on exported functions. Tests use `// #given`, `// #when`, `// #then`.
- Domain data (pinouts, protocol timings, character ROMs) is typed from the official document named in the file. Never fill gaps from memory.
- Dependencies stay minimal. Ask before adding one a component would carry into a user's project.

## Adding a component, end to end

1. **Source**: `registry/benchcn/ui/<name>/<name>.tsx` (+ sub-parts). Header comment, named exports, works standalone against `createMockDevice()`.
2. **Registry entry**: add to `registry/registry.ts` with `type`, `title`, `description`, `files`, `dependencies`, `registryDependencies` (include `@benchcn/tokens`), `categories`, `docs`.
3. **Tests**: any pure logic (measurements, decoding, formatting) in a sibling `*.test.ts`.
4. **Demo**: `src/components/demos/<name>-demo.tsx`, used by the docs page and, if it belongs there, the landing bench.
5. **Docs page**: `content/docs/components/<name>.mdx` with preview, install tabs, usage, props table, examples, accessibility notes, and the copy-prompt block.
6. **Verify**: `pnpm check && pnpm build && pnpm e2e && pnpm registry:test`, then open the page in both colour schemes and at phone width.

The `add-component` skill in `.agents/skills/` walks through the same steps with templates. Skills live under `.agents/skills/` so any agent can use them; read the relevant `SKILL.md` before starting one of these tasks, since not every agent discovers that directory on its own.

## Definition of done (per component)

- Installs cleanly into a fresh Vite + shadcn project: `pnpm registry:test` checks this for every item, including the documented import paths.
- Works against `createMockDevice()` with zero config; documented props for real data.
- Dark and light themes, any shadcn base colour, responsive, reduced motion respected.
- Keyboard and screen-reader support documented on the page.
- Docs page complete: preview, install, usage, API, examples, accessibility.
- Logic covered by tests; oxlint, oxfmt and typecheck clean.

## Phases and checkpoints

1. Plan. 2. Foundation. 3. Design spike: oscilloscope, logic analyzer with I²C decode, actuator control (checkpoint). 4. v1 components. 5. Landing page and blocks (checkpoint). 6. Launch prep.

Commit messages: `<type>: <description>` with feat/fix/docs/style/refactor/test/chore, lowercase, present tense, no trailing period, backticks around identifiers, no attribution lines.
