---
name: benchcn
description: Build hardware, IoT, robotics and maker dashboards with the @benchcn shadcn/ui registry: which component to use for which reading or control, which data source fits the situation, the benchcn wire protocol the firmware must speak, and the domain rules (commanded vs. confirmed, setpoints, alarms, units, pin conflicts). Use when a user asks for a dashboard, telemetry UI, sensor display, instrument panel, bench or lab tool, alarm panel or device control page for a Raspberry Pi, Pico, ESP32, Arduino, robot or home-automation project.
---

# benchcn

Docs: https://nathan-abela.github.io/benchcn (every page also at `<url>.md`; index at `/llms.txt`, full text at `/llms-full.txt`). When a prop is unclear, read the component's `.md` page rather than guessing.

## Setup (once per project)

1. The project needs shadcn/ui with Tailwind v4. If it does not have `components.json`, run `npx shadcn@latest init`.
2. Add the registry to `components.json`:
   ```json
   { "registries": { "@benchcn": "https://nathan-abela.github.io/benchcn/r/{name}.json" } }
   ```
3. Install items with `npx shadcn@latest add @benchcn/<item>`. Dependencies (`tokens`, `instrument`, `mock-device`, `wire`, hooks) come along automatically.

## Pick components by what the user needs to see or do

| Need                                                             | Component                                             | Key props                                                                                                             |
| ---------------------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| A slow reading with a unit (temperature, humidity, battery)      | `sensor-tile`                                         | `label`, `value`, `unit`, `thresholds` `{ min, max, low, high, warnBelow, warnAbove }`, `history`, `updatedAt`.      |
| Where a value sits against its limits and setpoint               | `range-bar`                                           | `value`, `min`, `max`, `thresholds`, `setpoint`, `commanded`, `recent`, `orientation`. Prefer it to a round gauge.    |
| How slow channels move over the last minute, with CSV export     | `strip-chart`                                         | `series` from `useStripSeries(source, ["soil", "temp"])`, `seconds`, `staleAfter`. Mixed units stack into lanes.      |
| A value people read precisely, with hold and min/max/avg         | `meter-readout`                                       | `label`, `mode`, `value`, `unit`, `sampleKey` (pass the sample object).                                               |
| Numeric readout that looks like hardware                         | `seven-segment`                                       | `value`, `digits`, `decimals`, `color`, `colon`.                                                                      |
| Text display like a 16x2 LCD                                     | `character-lcd`                                       | `lines`, `cols`, `rows`, `color`, `backlight`, `customGlyphs`. HD44780 glyphs.                                        |
| Graphics on a small OLED (SSD1306)                               | `oled-display`                                        | `bitmap` drawn with `@/lib/bitmap`, or raw `buffer`; `color`, `on`, `invert`, `label`.                                |
| Scrolling text or icons on LED dots                              | `led-matrix`                                          | `text`, `cols` (8 per module), `color`, `speed`; `bitmap` for icons.                                                  |
| Coarse level as a row of LEDs                                    | `led-bar`                                             | `label`, `value`, `min`, `max`, `segments`, `mode`, `thresholds`, `orientation`.                                      |
| Battery charge                                                   | `battery-indicator`                                   | `value` (percent, or volts with `unit="V"`, `min`, `max` or `curve`), `thresholds` `{ low, critical }`, `charging`.   |
| Radio signal (Wi-Fi RSSI, link quality)                          | `signal-strength`                                     | `value` in dBm or `unit="%"`, `bars`, `thresholds` (one per bar; defaults are Android's Wi-Fi levels).                |
| Whether the device is connected and still talking                | `connection-status`                                   | `source` (any source handle), `label`, `staleAfter`; or plain `status`, `attempts`, `lastMessageAt`.                  |
| On/off/fault indicator                                           | `status-led`                                          | `label`, `on`, `color`, `pattern` (`steady`, `blink`, `pulse`, `heartbeat`), `rate`.                                  |
| Turn something on/off safely (relay, pump, motor enable)         | `actuator-control`                                    | Spread `actuators.<id>` and pass `onCommand={(on) => command(id, on)}`. Press-and-hold by default (`holdMs`).        |
| Set a number on the device (heater, supply voltage, motor speed) | `setpoint-input`                                      | Spread `setpoints.<id>`, pass `min`, `max`, `step`, `unit`, `onCommand={(v) => command(id, v)}`, optional `confirm`. |
| Turn a knob to set a number, with a push button                  | `rotary-encoder`                                      | Spread `setpoints.<id>`, pass `min`, `max`, `step`, `unit`, `onCommand={(v) => command(id, v)}`, `onPress`, `wrap`.  |
| Dim an LED, set a servo angle or motor duty by dragging          | `pwm-slider`                                          | Spread `setpoints.<id>`; stream with `onChange={(v) => send(setCommand(id, v))}`, commit with `onCommand` and `command`. |
| Run something only while held (jog, horn, pump prime)            | `momentary-button`                                    | Spread `actuators.<id>`, `onCommand={(on) => command(id, on)}`. Sends off on release, blur and hidden tab.            |
| Jog an axis or pan/tilt in fixed steps                           | `d-pad`                                               | `onJog` gets `{ x, y }` per step; add to the last commanded target and `command` it. `steps`, `onHome`, `position`.  |
| Alarms an operator must acknowledge                              | `alarm-list`                                          | `alarms` from `useAlarms(source, rules)`, plus `onAcknowledge`, `onAcknowledgeAll`, `onShelve`, `onUnshelve`.         |
| Analog waveform (audio, ADC, motor current)                      | `oscilloscope`                                        | `channels` `[{ id, data, sampleRate, voltsPerDiv }]`, `timebase`, `trigger` `{ level, edge }`.                       |
| Digital lines, bus traffic                                       | `logic-analyzer`                                      | `lanes`, `decode={{ protocol: "i2c", sda: "sda", scl: "scl" }}` (or `"spi"`, `"uart"`, `"modbus"`), `defaultWindow="first"`.      |
| Device logs and a command line                                   | `serial-console`                                      | `lines` mapped from `logs`, `onCommand` sends raw lines.                                                              |
| Explain wiring in docs                                           | `pinout-header`, `bitfield-diagram`, `timing-diagram` | Data-driven from board files, register specs and WaveJSON-style signals.                                              |
| Wiring list for build notes                                      | `wiring-table`                                        | Same `board` and `assignments` as `pinout-header`; add `wire` and `note`. Copies Markdown, downloads CSV.          |
| Stop a robot or machine from the page                            | `emergency-stop`                                      | Spread `actuators.estop`, `onCommand={(on) => command("estop", on)}`. A software stop only; never the safety function. |
| Drive a robot by touch, keys or gamepad (teleop)                 | `joystick`                                          | `onChange` gets `{ x, y }` at `rate` Hz and one zero on release; send velocities with `send`, not `command`.        |
| Where a robot has been                                           | `odometry-plot`                                       | `path` and `pose` from `usePoseTrail(source)`.                                                                      |
| Whole dashboard in one go                                        | blocks `power-bench`, `robot`, `plant-monitor`, `weather-station` | Start here, then edit. Each takes `source`, `channels` and `layout="kiosk"`.                                       |

## Pick a data source by the situation

- **No hardware yet, demo, tests:** `useMockDevice()`. Deterministic, with sensors, a pump relay, a heater setpoint, a bench supply that switches between CV and CC, ack latency and dropped commands.
- **Device on the network (ESP32, Pico W, Raspberry Pi):** `useWebSocketSource("ws://<host>/ws")`. The firmware serves a WebSocket and prints wire-protocol lines.
- **Board plugged into this computer over USB:** `useSerialSource({ baudRate: 115200 })`. Web Serial works in Chromium and Firefox desktop, not Safari or iOS, and must be opened from a click handler. Prefer WebSocket when the device has a network.
- **ROS 2 robot running `rosbridge_server`:** `useRosbridgeSource("ws://<host>:9090", { channels })`. Map each channel id to `{ topic, type, field }` (field is a dot path, default `"data"`); commanded channels add `kind` and `command: { topic, type, field }`.
- **FRC robot or other NetworkTables 4 server:** `useNt4Source(nt4Url("<host>"), { channels })`. Map each channel id to `{ topic, index }` (`index` picks an array element); commanded channels add `kind` and `command: { topic, type: "boolean" | "double" | "int" | "float" }`.
- **Existing MQTT broker:** not built yet; bridge MQTT to WebSocket.

For both robot sources, a command is confirmed only when the robot reports the value back on the channel's `topic`. Always map a state topic for e-stops, drives and anything an operator relies on; without one every command ends in `timeout`, on purpose.

If the user laid out a dashboard in the Studio (`/studio` on the docs site), start from its exported `dashboard.tsx` and install command rather than rebuilding the layout.

Every source returns the same handle: `readings`, `history`, `logs`, `actuators`, `setpoints`, `hello`, `received`, `command(id, value)`, `send`, `store`. Components never connect by themselves. Create one source at the top of the page and pass it down. For waveforms from a real device, feed `useRingBuffer(source.store, "ch1")` to the scope.

## The wire protocol (what the firmware prints)

Newline-delimited JSON, one object per line. Keep keys exactly as below.

```
{"hello":"benchcn/0","dev":"my-device","chs":[{"id":"temp","u":"°C","kind":"sensor"},{"id":"pump","kind":"actuator"},{"id":"heater","u":"°C","min":15,"max":35,"kind":"setpoint"}]}
{"ch":"temp","v":21.4,"u":"°C","t":1731000000}
{"ch":"ch1","vs":[0.1,0.5,0.9],"sr":10000,"u":"V"}
{"log":"boot ok","lvl":"info"}
```

The dashboard sends `{"cmd":"set","n":17,"id":"pump","v":true}` for an actuator or `{"cmd":"set","n":18,"id":"heater","v":24.5}` for a setpoint. The device must reply with the value it actually applied: `{"ack":18,"ok":true,"id":"heater","v":24.5}`, or `"ok":false,"err":"..."`. A device that clamps 40 to 35 acks `"v":35` and the UI shows the mismatch. Plain text lines show as logs, so existing `print()` debugging keeps working. `t` is seconds since the epoch, or seconds since boot if the device has no clock.

## Domain rules the UI must respect

- **Commanded is not confirmed.** Never render an actuator or setpoint as applied because the user pressed or typed it. Show pending until the matching `ack`. Set `actuatorTimeout` and `failSafe` on the source so a timeout shows the state the firmware falls back to.
- **Streams stop on release.** Teleop sends velocities while input is held and a zero when it stops; the device must also stop on its own when commands stop arriving (a watchdog), because a dropped link sends nothing.
- **A software e-stop is not a safety function.** Reset must never restart the machine; enabling the drive again is a separate action.
- **Setpoints are drafts until applied.** Out-of-range values never leave the page; use `confirm` for changes that matter.
- **Alarms come from rules, not ad hoc state.** Give each rule a `deadband`, add a `staleAfter` rule for every channel an operator depends on, and never drop an alarm nobody acknowledged.
- **Colour means abnormal.** Normal values stay neutral; warning and alarm colours appear only past a limit, and the state is always written as a word too.
- **Units travel with values.** Pass `u` through; do not hard-code units in labels. Thresholds are in the same unit as the value. Convert units on the source with `transform`, not per component.
- **Pin conflicts.** A physical pin carries one function. `pinout-header` and `wiring-table` flag conflicts when two parts claim the same pin, a bus role is duplicated, or a part with `voltage` set drives a pin above the board logic level.
- **Time.** Send `t` from the device; tiles use it for staleness. Strip charts stamp samples on arrival on purpose, so a device with a wrong or missing clock still scrolls in step with the page.
- **Offline first.** No CDN scripts or web fonts at runtime; dashboards often run on a Raspberry Pi with no internet.
- **Touch and kiosk.** Prefer targets of at least 44 px and the `kiosk` layout for 800x480 screens.

## A minimal page

```tsx
import { ActuatorControl } from "@/components/ui/actuator-control";
import { SensorTile } from "@/components/ui/sensor-tile";
import { useMockDevice } from "@/hooks/use-mock-device";
import { INITIAL_ACTUATOR_STATE } from "@/lib/actuator";

export function Dashboard() {
  const { readings, history, actuators, command } = useMockDevice({
    actuatorTimeout: 2000,
    failSafe: { pump: false },
  });
  const soil = readings.soil;
  return (
    <div className="grid gap-4 p-4 sm:grid-cols-2">
      <SensorTile
        label="Soil moisture"
        value={typeof soil?.v === "number" ? soil.v : null}
        unit={soil?.u}
        thresholds={{ min: 0, max: 100, low: 20, warnBelow: 30 }}
        history={history.soil}
        updatedAt={soil?.t ? soil.t * 1000 : undefined}
      />
      <ActuatorControl
        label="Pump"
        {...(actuators.pump ?? INITIAL_ACTUATOR_STATE)}
        onCommand={(on) => command("pump", on)}
      />
    </div>
  );
}
```

Swap `useMockDevice()` for `useWebSocketSource(url)` when the hardware is ready; the components do not change.
