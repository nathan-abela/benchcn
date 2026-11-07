# benchcn

[![shadcn/ui](https://shieldcn.dev/badge/shadcn%2Fui-000000.svg?logo=shadcnui&logoColor=white&variant=branded&size=xs)](https://ui.shadcn.com#gh-light-mode-only)
[![shadcn/ui](https://shieldcn.dev/badge/shadcn%2Fui-ffffff.svg?logo=shadcnui&logoColor=black&variant=branded&size=xs)](https://ui.shadcn.com#gh-dark-mode-only)
[![CI](https://shieldcn.dev/github/ci/nathan-abela/benchcn.svg?size=xs&mode=light)](https://github.com/nathan-abela/benchcn/actions/workflows/ci.yml#gh-light-mode-only)
[![CI](https://shieldcn.dev/github/ci/nathan-abela/benchcn.svg?size=xs&mode=dark)](https://github.com/nathan-abela/benchcn/actions/workflows/ci.yml#gh-dark-mode-only)
[![License](https://shieldcn.dev/github/license/nathan-abela/benchcn.svg?size=xs&mode=light)](https://github.com/nathan-abela/benchcn/blob/main/LICENSE#gh-light-mode-only)
[![License](https://shieldcn.dev/github/license/nathan-abela/benchcn.svg?size=xs&mode=dark)](https://github.com/nathan-abela/benchcn/blob/main/LICENSE#gh-dark-mode-only)
[![Stars](https://shieldcn.dev/github/stars/nathan-abela/benchcn.svg?size=xs&mode=light)](https://github.com/nathan-abela/benchcn/stargazers#gh-light-mode-only)
[![Stars](https://shieldcn.dev/github/stars/nathan-abela/benchcn.svg?size=xs&mode=dark)](https://github.com/nathan-abela/benchcn/stargazers#gh-dark-mode-only)
[![Views](https://shieldcn.dev/views/repo/nathan-abela/benchcn.svg?size=xs&mode=light)](https://github.com/nathan-abela/benchcn#gh-light-mode-only)
[![Views](https://shieldcn.dev/views/repo/nathan-abela/benchcn.svg?size=xs&mode=dark)](https://github.com/nathan-abela/benchcn#gh-dark-mode-only)

Hardware and maker UI components for shadcn/ui. Instruments that work, not instruments that look like it.

Oscilloscope, logic analyzer with I²C decode, seven-segment and character-LCD displays, GPIO pinout maps, register and timing diagrams, a serial console, and actuator controls that know the difference between _commanded_ and _confirmed_. Every component is live against a mock device out of the box and connects to real hardware through small data-source hooks.

**Docs:** https://nathan-abela.github.io/benchcn

> Status: foundation. The design spike (oscilloscope, logic analyzer, actuator control) is next. See [ROADMAP.md](ROADMAP.md).

## Install

Add the registry once to `components.json`:

```json
{
  "registries": {
    "@benchcn": "https://nathan-abela.github.io/benchcn/r/{name}.json"
  }
}
```

Then add components:

```bash
pnpm dlx shadcn@latest add @benchcn/sensor-tile
```

## Both ends of the wire

Devices speak a tiny newline-delimited JSON protocol, `benchcn/0`:

```json
{"ch":"soil","v":42,"u":"%","t":1731000000}
{"cmd":"set","n":17,"id":"pump","v":true}
{"ack":17,"ok":true,"id":"pump","v":true}
```

Firmware snippets for Raspberry Pi (Python), MicroPython and Arduino ship in `device/`. See the [wire protocol](https://nathan-abela.github.io/benchcn/docs/wire-protocol).

## Theming

Chrome follows your shadcn tokens. Channels use `--chart-1` to `--chart-5`. Physical colours (LEDs, backlights, segments) are a `color` prop. Two extra tokens, `--success` and `--warning`, come with `@benchcn/tokens`.

## AI assistants

The docs work as well for an assistant as for a person: every page has a Markdown twin (append `.md` to the URL), the site serves `llms.txt` and `llms-full.txt`, and each component page has a **Copy prompt** button. A skill that teaches an assistant which component and data source to reach for lives in [.agents/skills/benchcn](.agents/skills/benchcn/SKILL.md):

```bash
npx skills add nathan-abela/benchcn -s benchcn
```

## Development

```bash
pnpm install
pnpm dev        # http://localhost:3000/benchcn/
pnpm check      # lint, format, tests, build, typecheck
pnpm e2e        # Playwright smoke test against the static build
```

[AGENTS.md](AGENTS.md) has the folder map, conventions and the end-to-end recipe for adding a component.

## License

MIT. Board pinouts are typed from the official datasheets cited in each data file. No artwork from Fritzing, Wokwi or pinout.xyz is used.
