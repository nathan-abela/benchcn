<p align="center">
  <img src="./.github/assets/og.png" alt="benchcn: Hardware UI for shadcn/ui, beside an oscilloscope screen showing a sine and a square wave" />
</p>

<h1 align="center">benchcn</h1>

<p align="center">
  Hardware and maker UI components for shadcn/ui.<br/>
  Instruments that work, not instruments that look like it.
</p>

<p align="center">
  <a href="https://ui.shadcn.com"><img src="https://shieldcn.dev/badge/shadcn%2Fui-000000.svg?logo=shadcnui&logoColor=white&variant=branded&size=xs#gh-light-mode-only" alt="shadcn/ui" /></a>
  <a href="https://ui.shadcn.com"><img src="https://shieldcn.dev/badge/shadcn%2Fui-ffffff.svg?logo=shadcnui&logoColor=black&variant=branded&size=xs#gh-dark-mode-only" alt="shadcn/ui" /></a>
  <a href="https://github.com/nathan-abela/benchcn/actions/workflows/ci.yml"><img src="https://shieldcn.dev/github/ci/nathan-abela/benchcn.svg?size=xs&mode=light#gh-light-mode-only" alt="CI" /></a>
  <a href="https://github.com/nathan-abela/benchcn/actions/workflows/ci.yml"><img src="https://shieldcn.dev/github/ci/nathan-abela/benchcn.svg?size=xs&mode=dark#gh-dark-mode-only" alt="CI" /></a>
  <a href="https://github.com/nathan-abela/benchcn/blob/main/LICENSE"><img src="https://shieldcn.dev/github/license/nathan-abela/benchcn.svg?size=xs&mode=light#gh-light-mode-only" alt="License" /></a>
  <a href="https://github.com/nathan-abela/benchcn/blob/main/LICENSE"><img src="https://shieldcn.dev/github/license/nathan-abela/benchcn.svg?size=xs&mode=dark#gh-dark-mode-only" alt="License" /></a>
  <a href="https://github.com/nathan-abela/benchcn/stargazers"><img src="https://shieldcn.dev/github/stars/nathan-abela/benchcn.svg?size=xs&mode=light#gh-light-mode-only" alt="Stars" /></a>
  <a href="https://github.com/nathan-abela/benchcn/stargazers"><img src="https://shieldcn.dev/github/stars/nathan-abela/benchcn.svg?size=xs&mode=dark#gh-dark-mode-only" alt="Stars" /></a>
  <a href="https://github.com/nathan-abela/benchcn"><img src="https://shieldcn.dev/views/repo/nathan-abela/benchcn.svg?size=xs&mode=light#gh-light-mode-only" alt="Views" /></a>
  <a href="https://github.com/nathan-abela/benchcn"><img src="https://shieldcn.dev/views/repo/nathan-abela/benchcn.svg?size=xs&mode=dark#gh-dark-mode-only" alt="Views" /></a>
</p>

<p align="center">
  <a href="https://nathan-abela.github.io/benchcn/docs">Docs</a> ·
  <a href="https://nathan-abela.github.io/benchcn/docs/installation">Installation</a> ·
  <a href="https://nathan-abela.github.io/benchcn/docs/components">Components</a> ·
  <a href="https://nathan-abela.github.io/benchcn/docs/blocks">Blocks</a>
</p>

Oscilloscope, logic analyzer with I²C decode, strip chart, meter, seven-segment and character-LCD displays, GPIO pinout maps, register and timing diagrams, a serial console, an alarm list, and actuator and setpoint controls that know the difference between _commanded_ and _confirmed_. Every component is live against a mock device out of the box and connects to real hardware through small data-source hooks.

## What is in it

- **Signals:** oscilloscope, logic analyzer with I²C decode, strip chart with CSV export.
- **Readouts:** sensor tile, range bar, meter readout, alarm list with acknowledgement and shelving, odometry plot.
- **Controls:** actuator control and setpoint input, both tracking commanded vs. confirmed through the device's acknowledgements; an emergency stop with a two-step reset; a teleop pad for touch, keys or a gamepad.
- **Displays:** status LED, seven-segment display, character LCD, serial console.
- **Board and docs:** pinout header with four boards, bitfield diagram, timing diagram.
- **Blocks:** power bench, robot, plant monitor and weather station, each with an 800×480 kiosk layout.
- **Data:** hooks for the mock device, WebSocket and Web Serial sources, a ring buffer, strip-chart series and alarm rules. Pure I²C, SPI and UART decoders with encoders and tests.

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

The [wire protocol](https://nathan-abela.github.io/benchcn/docs/wire-protocol) page has every message, including numeric setpoints and the hello that announces channels.

## Theming

Chrome follows your shadcn tokens. Channels use `--channel-1` to `--channel-4`, falling back to `--chart-1` to `--chart-5`. Physical colours (LEDs, backlights, segments) are a `color` prop. Two extra tokens, `--success` and `--warning`, come with `@benchcn/tokens`.

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
