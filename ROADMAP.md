# Roadmap

v1 is the starred list from the original brief. Everything else lives here so it is not built early.

## After v1

### Components

- Displays: `oled-display` (128×64 SSD1306-style framebuffer), `led-matrix` (8×8, chained, scrolling text), `led-bar`.
- Signals: SPI and UART decode overlays on the logic analyzer (the pure decoders ship in v1); a Modbus RTU decoder with a general frame list, reusing the analyzer's transaction view.
- Readouts: `battery-indicator`, `signal-strength`, `connection-status`.
- Controls: `toggle-switch`, `rotary-encoder`, `pwm-slider`, `momentary-button`, `d-pad`.
- Board and docs: `wiring-table`.
- Comms: `hex-dump`.
- Small additions: min and max markers on the sensor-tile sparkline, ordered threshold rules with a fallback, WaveJSON input for the timing and bitfield diagrams.

### Robotics

- `emergency-stop` (an `actuator-control` variant: latched, always visible, two-step reset), `gamepad-teleop` (on-screen pad plus the Gamepad API, stop on release), `camera-feed`, `odometry-plot`, `motor-panel`, a map.
- Data sources: `rosbridge` (ROS 2 topics over WebSocket, spec: rosbridge v2 protocol) and FIRST NetworkTables NT4. Verify both against the official specs before building.

### Data sources

- `useMqttSource` (MQTT over WebSocket, needs `mqtt.js`).
- Web Bluetooth source for BLE UART-style devices.

### Blocks

- Robot telemetry: promote the Robot scenario already composed in `src/components/site/scenario-tabs.tsx`, with a kiosk route.
- Smart-home relay panel: a bank of relays with commanded vs. confirmed state, plus room sensors.
- 3D printer or CNC panel: temperatures, axis positions, job progress, pause and stop.
- Test report: pass/fail phases and measurements with limits, in the shape of OpenHTF.
- Auto dashboard: built at runtime from the channel list in the device's `hello` message.
- Embedded docs page (pinout + bitfield + timing in prose).

### Site

- Studio: arrange components, bind them to the mock device or a WebSocket URL, export code.
- `benchcn.dev` custom domain (one config change plus the basepath).
- Registry download counting, only if PostHog copy events and GitHub code search prove too thin a signal.

### Agent tooling

- Agent evals in `evals/` run on a schedule; results fed back into docs and the public skill.
- shadcn MCP recipe page.

## Deferred while building v1

- Logic analyzer overlays for SPI and UART (the decoders exist and are tested; only I2C is drawn).
- WaveJSON node and edge annotations (arrows, timing constraints) in the timing diagram.
- Character LCD 5x10 font mode and typing katakana or Greek through the A00 code map.
- Keyboard editing of individual bits in the bitfield diagram (clicking works; pair with inputs for now).
- Oscilloscope cursors, X-Y mode and FFT.
- Pinout header: per-pin ALT0 to ALT5 tables for the Raspberry Pi, more boards (Pico 2, ESP32-S3, Nano).
- Registry item for a standalone channel colour palette switcher.
