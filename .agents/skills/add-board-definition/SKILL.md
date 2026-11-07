---
name: add-board-definition
description: Add a typed pinout data file for a development board under registry/benchcn/boards, sourced from the official documentation and cited in the file. Use when asked to support a new board in pinout-header or wiring-table.
---

# Add a board definition

Board data is the moat. Every pin comes from the official document and nothing is filled from memory.

## 1. Find the authoritative source

| Board                      | Source                                                                                         |
| -------------------------- | ---------------------------------------------------------------------------------------------- |
| Raspberry Pi 40-pin header | https://www.raspberrypi.com/documentation/computers/raspberry-pi.html#gpio                     |
| Raspberry Pi Pico          | https://datasheets.raspberrypi.com/pico/pico-datasheet.pdf                                     |
| Raspberry Pi Pico 2        | https://datasheets.raspberrypi.com/pico/pico-2-datasheet.pdf                                   |
| ESP32-DevKitC V4           | https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32/esp32-devkitc/user_guide.html |
| Arduino UNO R3             | https://docs.arduino.cc/resources/pinouts/A000066-full-pinout.pdf                              |

For any other board, use the vendor's own datasheet or docs site. Do not use pinout.xyz (CC BY-SA), Fritzing parts, or Wokwi artwork, and do not copy their layouts.

## 2. Write the file

`registry/benchcn/boards/<board-id>.ts`:

```ts
// benchcn.dev · boards-<board-id>
import type { BoardDefinition } from "@/registry/benchcn/boards/types";

export const <camelId>: BoardDefinition = {
  id: "<board-id>",
  name: "<Board name as the vendor writes it>",
  source: { title: "<document title>", url: "<url>", retrieved: "<YYYY-MM-DD>" },
  headers: [
    {
      id: "j8",
      label: "J8",
      rows: 20,
      columns: 2,
      pins: [
        { number: 1, name: "3V3", kind: "power", functions: [] },
        { number: 3, name: "GPIO2", kind: "gpio", functions: ["I2C1 SDA"], alt: { i2c: { bus: 1, role: "sda" } } },
      ],
    },
  ],
};
```

Rules:

- Pin `number` is the physical pin number printed in the source, `name` is the primary label there, `kind` is one of `power | ground | gpio | reserved | nc`.
- `functions` are human-readable alternate functions exactly as the source names them. Structured `alt` entries (`i2c`, `spi`, `uart`, `pwm`, `adc`) feed pin-conflict detection; add them only where the source is explicit.
- Physical layout fields (`rows`, `columns`, orientation) describe the header geometry, not any third party's drawing.

## 3. Register and test

- Export the board from `registry/benchcn/boards/index.ts` and add a `registry:lib` entry in `registry/registry.ts` with `files` pointing at the board file and `types.ts`.
- Add it to `registry/benchcn/boards/boards.test.ts`: pin count matches the source, numbers are unique and contiguous, every `alt` role references a known bus, and power/ground counts match the datasheet.
- Document it on `content/docs/components/pinout-header.mdx` under "Supported boards" with the source link.
