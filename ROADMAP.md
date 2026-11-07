# Roadmap

v1 is the starred list from the original brief. Everything else lives here so it is not built early.

## After v1

### Components

- Displays: `oled-display` (128×64 SSD1306-style framebuffer), `led-matrix` (8×8, chained, scrolling text), `led-bar`.
- Signals: `strip-chart`, `multimeter`; SPI and UART decode overlays on the logic analyzer (the pure decoders ship in v1).
- Readouts: `battery-indicator`, `signal-strength`, `connection-status`.
- Controls: `toggle-switch`, `rotary-encoder`, `pwm-slider`, `momentary-button`, `d-pad`.
- Board and docs: `wiring-table`.
- Comms: `hex-dump`.

### Robotics

- `emergency-stop`, `gamepad-teleop`, `camera-feed`, `odometry-plot`, `motor-panel`.
- Data sources: `rosbridge` (ROS 2 topics over WebSocket, spec: rosbridge v2 protocol) and FIRST NetworkTables NT4. Verify both against the official specs before building.

### Data sources

- `useMqttSource` (MQTT over WebSocket, needs `mqtt.js`).
- Web Bluetooth source for BLE UART-style devices.

### Blocks

- Robot telemetry, home-automation panel, embedded docs page (pinout + bitfield + timing in prose).
- Kiosk layout for 800×480 touchscreens.

### Site

- Studio: arrange components, bind them to the mock device or a WebSocket URL, export code.
- `benchcn.dev` custom domain (one config change plus the basepath).
- Registry download counting, only if PostHog copy events and GitHub code search prove too thin a signal.

### Agent tooling

- Agent evals in `evals/` run on a schedule; results fed back into docs and the public skill.
- shadcn MCP recipe page.
