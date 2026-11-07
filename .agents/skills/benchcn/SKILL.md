---
name: benchcn
description: Build hardware, IoT, robotics and maker dashboards with the @benchcn shadcn/ui registry: which component to use for which reading or control, which data source fits the situation, the benchcn wire protocol the firmware must speak, and the domain rules (commanded vs. confirmed, units, pin conflicts). Use when a user asks for a dashboard, telemetry UI, sensor display, instrument panel or device control page for a Raspberry Pi, Pico, ESP32, Arduino, robot or home-automation project.
---

# benchcn

Docs: https://nathan-abela.github.io/benchcn (every page also at `<url>.md`; index at `/llms.txt`, full text at `/llms-full.txt`).

## Setup (once per project)

1. The project needs shadcn/ui with Tailwind v4. If it does not have `components.json`, run `pnpm dlx shadcn@latest init`.
2. Add the registry to `components.json`:
   ```json
   { "registries": { "@benchcn": "https://nathan-abela.github.io/benchcn/r/{name}.json" } }
   ```
3. Install items with `pnpm dlx shadcn@latest add @benchcn/<item>`. Dependencies (`tokens`, `mock-device`, `wire`) come along automatically.

## Pick components by what the user needs to see or do

| Need                                                        | Component                                             | Notes                                                                                      |
| ----------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| A slow reading with a unit (temperature, humidity, battery) | `sensor-tile`                                         | Big value, unit, state text, threshold bar, sparkline. Pass `thresholds` for colour zones. |
| Analog waveform (audio, ADC, motor current)                 | `oscilloscope`                                        | Needs a `block` source or `device.waveform()`. Set `timebase`, `voltsPerDiv`, `trigger`.   |
| Digital lines, bus traffic                                  | `logic-analyzer`                                      | Pass lanes; enable `decode: "i2c"` for SDA/SCL.                                            |
| Turn something on/off safely (relay, pump, motor enable)    | `actuator-control`                                    | Press-and-hold. Shows commanded vs. confirmed. Set `timeout` and `failSafe`.               |
| Numeric readout that looks like hardware                    | `seven-segment`                                       | `value`, `digits`, `decimals`, `color`.                                                    |
| Text display like a 16x2 LCD                                | `character-lcd`                                       | `lines`, `cols`, `rows`, `backlight`. HD44780 glyphs.                                      |
| On/off/fault indicator                                      | `status-led`                                          | `state`, `color`, `pattern` (steady, blink, pulse).                                        |
| Device logs and a command line                              | `serial-console`                                      | Feed it `log` messages; `onCommand` sends raw lines.                                       |
| Explain wiring in docs                                      | `pinout-header`, `bitfield-diagram`, `timing-diagram` | Data-driven from board files, register specs and WaveJSON-style specs.                     |
| Whole dashboard in one go                                   | blocks `plant-monitor`, `weather-station`             | Start here, then edit.                                                                     |

## Pick a data source by the situation

- **No hardware yet, demo, tests:** `createMockDevice()` via `useMockDevice()`. Deterministic; includes a pump relay with ack latency and faults.
- **Device on the network (ESP32, Pico W, Raspberry Pi):** `useWebSocketSource("ws://<host>/ws")`. The firmware serves a WebSocket and prints wire-protocol lines.
- **Board plugged into this computer over USB:** `useSerialSource({ baudRate: 115200 })`. Web Serial is Chromium-only and must be opened from a click handler.
- **Existing MQTT broker:** `useMqttSource` (planned; until then bridge MQTT to WebSocket).

Components never connect by themselves. Create one source at the top of the page and pass readings and `send` down.

## The wire protocol (what the firmware prints)

Newline-delimited JSON, one object per line. Keep keys exactly as below.

```
{"hello":"benchcn/0","dev":"my-device","chs":[{"id":"temp","u":"°C","kind":"sensor"},{"id":"pump","kind":"actuator"}]}
{"ch":"temp","v":21.4,"u":"°C","t":1731000000}
{"ch":"ch1","vs":[0.1,0.5,0.9],"sr":10000,"u":"V"}
{"log":"boot ok","lvl":"info"}
```

Dashboard sends `{"cmd":"set","n":17,"id":"pump","v":true}`; the device must reply `{"ack":17,"ok":true,"id":"pump","v":true}` (or `"ok":false,"err":"..."`). Plain text lines are shown as logs, so existing `print()` debugging keeps working. `t` is seconds since the epoch, or seconds since boot if the device has no clock.

## Domain rules the UI must respect

- **Commanded is not confirmed.** Never render an actuator as "on" because the user pressed it. Show pending until the matching `ack` arrives; on timeout show an error and fall back to the `failSafe` state.
- **Units travel with values.** Pass `u` through; do not hard-code units in labels. Thresholds are in the same unit as the value.
- **Pin conflicts.** When composing a wiring page, a physical pin can carry one function. `pinout-header` flags conflicts when two parts claim the same pin or a bus role is duplicated.
- **Timestamps.** Use the sample's `t` for charts, not arrival time, so network jitter does not distort plots.
- **Offline first.** No CDN scripts or web fonts at runtime; dashboards often run on a Raspberry Pi with no internet.
- **Touch and kiosk.** Prefer targets of at least 44 px and the `kiosk` layout for 800x480 screens.

## A minimal page

```tsx
import { ActuatorControl } from "@/components/ui/actuator-control";
import { SensorTile } from "@/components/ui/sensor-tile";
import { useMockDevice } from "@/hooks/use-mock-device";

export function Dashboard() {
  const { readings, actuators, send } = useMockDevice();
  return (
    <div className="grid gap-4 p-4 sm:grid-cols-2">
      <SensorTile label="Soil moisture" reading={readings.soil} thresholds={[20, 40, 70]} />
      <ActuatorControl
        label="Pump"
        state={actuators.pump}
        onCommand={(on) => send("pump", on)}
        timeout={2000}
      />
    </div>
  );
}
```

Swap `useMockDevice()` for `useWebSocketSource(url)` when the hardware is ready; the components do not change.
