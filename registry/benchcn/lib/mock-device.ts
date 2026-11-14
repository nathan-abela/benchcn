// benchcn.dev · mock-device
// A simulated bench: slow sensors, a relay, a heater, a bench supply, a dimmable LED, a jog stage
// and a small robot, all with acknowledgement latency, waveform channels and log lines, all
// speaking the wire protocol. Deterministic for a given seed, so demos and tests behave the same
// every run.
import {
  type WireAck,
  type WireChannelInfo,
  type WireCommand,
  type WireMessage,
  type WireSample,
  type WireValue,
  WIRE_VERSION,
} from "@/registry/benchcn/lib/wire";

export type MockDeviceOptions = {
  seed?: number;
  /** Milliseconds between sensor samples. */
  sampleInterval?: number;
  /** Acknowledgement latency range for actuator commands, in milliseconds. */
  ackLatency?: [min: number, max: number];
  /** Probability (0 to 1) that a command is lost and never acknowledged. */
  faultRate?: number;
  /** Injectable clock and scheduler so tests can drive time by hand. */
  now?: () => number;
  setTimeout?: (fn: () => void, ms: number) => unknown;
  clearTimeout?: (handle: unknown) => void;
};

export type MockActuatorState = {
  id: string;
  commanded: boolean | number | null;
  confirmed: boolean | number;
  pending: boolean;
};

export type WaveformKind = "sine" | "square" | "triangle" | "sawtooth" | "noise";

export type MockDevice = {
  readonly channels: WireChannelInfo[];
  /** Subscribe to everything the device emits. Returns an unsubscribe function. */
  subscribe(listener: (message: WireMessage) => void): () => void;
  /** Send a command as the dashboard would; acks arrive through `subscribe`. */
  send(command: WireCommand): void;
  start(): void;
  stop(): void;
  readonly running: boolean;
  /** Current sensor readings, keyed by channel id. */
  readings(): Record<string, WireSample>;
  actuator(id: string): MockActuatorState | undefined;
  /** Samples a waveform channel: `n` points starting at `t0` (ms) at `sampleRate` Hz. */
  waveform(ch: string, t0: number, n: number, sampleRate: number): Float32Array;
};

const TAU = Math.PI * 2;

/** mulberry32: small, fast, seedable. */
export function createRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Sensor = {
  info: WireChannelInfo;
  read: (tSeconds: number, state: SimState) => number;
};

type SimState = {
  pumpOn: boolean;
  soil: number;
  /** Confirmed setpoints by channel id: the heater, and the supply's voltage and current limit. */
  setpoints: Record<string, number>;
  chamber: number;
  psuOn: boolean;
  psu: PsuOutput;
  robot: RobotState;
  rand: () => number;
};

const sensors: Sensor[] = [
  {
    info: { id: "temp", u: "°C", min: -10, max: 50, kind: "sensor", label: "Air temperature" },
    read: (t, s) => 21.5 + 2.5 * Math.sin((TAU * t) / 86400 - Math.PI / 2) + noise(s, 0.08),
  },
  {
    info: { id: "humidity", u: "%", min: 0, max: 100, kind: "sensor", label: "Humidity" },
    read: (t, s) => 52 - 8 * Math.sin((TAU * t) / 86400 - Math.PI / 2) + noise(s, 0.4),
  },
  {
    info: { id: "soil", u: "%", min: 0, max: 100, kind: "sensor", label: "Soil moisture" },
    read: (_, s) => s.soil + noise(s, 0.3),
  },
  {
    info: { id: "light", u: "lx", min: 0, max: 20000, kind: "sensor", label: "Light" },
    read: (t, s) => Math.max(0, 9000 * Math.sin((TAU * (t - 21600)) / 86400) + noise(s, 40)),
  },
  {
    info: { id: "battery", u: "V", min: 3.0, max: 4.2, kind: "sensor", label: "Battery" },
    read: (t, s) => 4.15 - ((t % 36000) / 36000) * 0.9 + noise(s, 0.004),
  },
  {
    info: { id: "pressure", u: "hPa", min: 950, max: 1050, kind: "sensor", label: "Pressure" },
    read: (t, s) => 1013 + 4 * Math.sin((TAU * t) / 172800) + noise(s, 0.1),
  },
  {
    info: { id: "chamber", u: "°C", min: 0, max: 50, kind: "sensor", label: "Chamber temperature" },
    read: (_, s) => s.chamber + noise(s, 0.05),
  },
  {
    info: { id: "psu-vout", u: "V", min: 0, max: 30, kind: "sensor", label: "Output voltage" },
    read: (_, s) => (s.psu.v === 0 ? 0 : s.psu.v + noise(s, 0.004)),
  },
  {
    info: { id: "psu-iout", u: "A", min: 0, max: 3, kind: "sensor", label: "Output current" },
    read: (_, s) => (s.psu.i === 0 ? 0 : s.psu.i + noise(s, 0.002)),
  },
  {
    // A meter at the load reads a little under the supply: current through the test leads drops volts.
    info: { id: "dmm-v", u: "V", min: 0, max: 30, kind: "sensor", label: "Meter at the load" },
    read: (_, s) =>
      s.psu.v === 0 ? noise(s, 0.0004) : s.psu.v - s.psu.i * LEAD_OHMS + noise(s, 0.0008),
  },
  {
    info: { id: "rssi", u: "dBm", min: -100, max: -30, kind: "sensor", label: "Wi-Fi signal" },
    read: (t, s) => -64 + 7 * Math.sin((TAU * t) / 900) + noise(s, 1.5),
  },
];

const robotSensors: Sensor[] = [
  {
    info: { id: "speed", u: "m/s", min: -0.5, max: 0.5, kind: "sensor", label: "Speed" },
    read: (_, s) => s.robot.v,
  },
  {
    info: { id: "turn-rate", u: "rad/s", min: -1.5, max: 1.5, kind: "sensor", label: "Turn rate" },
    read: (_, s) => s.robot.w,
  },
  {
    info: { id: "pose-x", u: "m", kind: "sensor", label: "Position x" },
    read: (_, s) => s.robot.x,
  },
  {
    info: { id: "pose-y", u: "m", kind: "sensor", label: "Position y" },
    read: (_, s) => s.robot.y,
  },
  {
    info: { id: "heading", u: "°", min: -180, max: 180, kind: "sensor", label: "Heading" },
    read: (_, s) => {
      const deg = (s.robot.heading * 180) / Math.PI;
      return ((((deg + 180) % 360) + 360) % 360) - 180;
    },
  },
];
sensors.push(...robotSensors);

const LEAD_OHMS = 0.05;

/** A differential-drive robot: commanded velocities, what it actually does, and where it has been. */
export type RobotState = {
  driveOn: boolean;
  estop: boolean;
  /** Measured linear (m/s) and angular (rad/s) velocity. */
  v: number;
  w: number;
  x: number;
  y: number;
  /** Heading in radians, counterclockwise from +x. */
  heading: number;
  /** Time of the last drive command, for the watchdog. */
  lastDrive: number;
  watchdogTripped: boolean;
};

/** Milliseconds without a drive command before the robot stops on its own. */
export const DRIVE_WATCHDOG_MS = 500;
const LINEAR_ACCEL = 1.2;
const ANGULAR_ACCEL = 4;

/**
 * Moves the robot one step: velocities ramp toward the target at a limited acceleration, and the
 * pose integrates them. The target is zero unless the drive is on, the e-stop is clear and drive
 * commands are still arriving.
 */
export function stepRobot(
  robot: RobotState,
  target: { v: number; w: number },
  dt: number,
  now: number,
): RobotState {
  const live = robot.driveOn && !robot.estop && now - robot.lastDrive <= DRIVE_WATCHDOG_MS;
  const toward = (current: number, goal: number, rate: number) =>
    current + Math.max(-rate * dt, Math.min(rate * dt, goal - current));
  const v = robot.estop ? 0 : toward(robot.v, live ? target.v : 0, LINEAR_ACCEL);
  const w = robot.estop ? 0 : toward(robot.w, live ? target.w : 0, ANGULAR_ACCEL);
  const heading = robot.heading + w * dt;
  return {
    ...robot,
    v,
    w,
    heading,
    x: robot.x + v * Math.cos(heading) * dt,
    y: robot.y + v * Math.sin(heading) * dt,
  };
}

const actuators: WireChannelInfo[] = [
  { id: "pump", kind: "actuator", label: "Water pump" },
  { id: "led", kind: "actuator", label: "Status LED" },
  { id: "heater", kind: "setpoint", u: "°C", min: 15, max: 35, label: "Heater setpoint" },
  { id: "psu-out", kind: "actuator", label: "Supply output" },
  { id: "psu-v", kind: "setpoint", u: "V", min: 0, max: 30, label: "Supply voltage" },
  { id: "psu-i", kind: "setpoint", u: "A", min: 0.05, max: 3, label: "Current limit" },
  { id: "drive", kind: "actuator", label: "Drive enable" },
  { id: "estop", kind: "actuator", label: "Emergency stop" },
  { id: "linear", kind: "setpoint", u: "m/s", min: -0.5, max: 0.5, label: "Linear velocity" },
  { id: "angular", kind: "setpoint", u: "rad/s", min: -1.5, max: 1.5, label: "Angular velocity" },
  { id: "conveyor", kind: "actuator", label: "Conveyor" },
  { id: "dimmer", kind: "setpoint", u: "%", min: 0, max: 100, label: "LED brightness" },
  { id: "jog-x", kind: "setpoint", u: "mm", min: -50, max: 50, label: "Stage X" },
  { id: "jog-y", kind: "setpoint", u: "mm", min: -50, max: 50, label: "Stage Y" },
];

const SETPOINT_START: Record<string, number> = {
  heater: 20,
  "psu-v": 5,
  "psu-i": 1,
  linear: 0,
  angular: 0,
  dimmer: 40,
  "jog-x": 0,
  "jog-y": 0,
};

/** Setpoints that stream while the user drags: applied on arrival and acknowledged quietly. */
const STREAMED = new Set(["linear", "angular", "dimmer"]);
const HEATER_START = SETPOINT_START.heater;
/** Seconds for the chamber to close about two thirds of the gap to the setpoint. */
const HEATER_LAG = 8;

const waveforms: Record<string, { kind: WaveformKind; freq: number; amp: number; offset: number }> =
  {
    ch1: { kind: "sine", freq: 1000, amp: 1.0, offset: 0 },
    ch2: { kind: "square", freq: 1000, amp: 1.65, offset: 1.65 },
    ch3: { kind: "triangle", freq: 500, amp: 0.5, offset: 0 },
    ch4: { kind: "noise", freq: 0, amp: 0.05, offset: 0 },
  };

export type PsuMode = "CV" | "CC" | "OFF";
export type PsuOutput = { v: number; i: number; mode: PsuMode };

/**
 * A bench supply into a resistive load: it holds the set voltage until the load would draw more
 * than the current limit, then holds the limit and lets the voltage fall (constant current).
 */
export function psuOutput(on: boolean, volts: number, limit: number, ohms: number): PsuOutput {
  if (!on || volts <= 0) return { v: 0, i: 0, mode: "OFF" };
  const wanted = volts / ohms;
  if (wanted <= limit) return { v: volts, i: wanted, mode: "CV" };
  return { v: limit * ohms, i: limit, mode: "CC" };
}

/** The device under test: a load that drifts between 4 and 20 ohms over 40 seconds. */
export function loadOhms(tSeconds: number): number {
  return 12 + 8 * Math.sin((TAU * tSeconds) / 40);
}

function noise(s: SimState, amplitude: number) {
  return (s.rand() - 0.5) * 2 * amplitude;
}

function waveSample(kind: WaveformKind, phase: number, rand: () => number): number {
  const p = phase - Math.floor(phase);
  switch (kind) {
    case "sine":
      return Math.sin(TAU * p);
    case "square":
      return p < 0.5 ? 1 : -1;
    case "triangle":
      return 1 - 4 * Math.abs(p - 0.5);
    case "sawtooth":
      return 2 * p - 1;
    case "noise":
      return rand() * 2 - 1;
  }
}

export function createMockDevice(options: MockDeviceOptions = {}): MockDevice {
  const {
    seed = 1,
    sampleInterval = 1000,
    ackLatency = [120, 400],
    faultRate = 0.04,
    now = () => Date.now(),
    setTimeout: schedule = (fn, ms) => globalThis.setTimeout(fn, ms),
    clearTimeout: cancel = (handle) => globalThis.clearTimeout(handle as number),
  } = options;

  const rand = createRandom(seed);
  const state: SimState = {
    pumpOn: false,
    soil: 38,
    setpoints: { ...SETPOINT_START },
    chamber: HEATER_START,
    psuOn: false,
    psu: { v: 0, i: 0, mode: "OFF" },
    robot: {
      driveOn: false,
      estop: false,
      v: 0,
      w: 0,
      x: 0,
      y: 0,
      heading: Math.PI / 2,
      lastDrive: 0,
      watchdogTripped: false,
    },
    rand,
  };
  const listeners = new Set<(message: WireMessage) => void>();
  const latest: Record<string, WireSample> = {};
  const actuatorState = new Map<string, MockActuatorState>(
    actuators.map((a) => [
      a.id,
      {
        id: a.id,
        commanded: null,
        confirmed: a.kind === "setpoint" ? (SETPOINT_START[a.id] ?? 0) : false,
        pending: false,
      },
    ]),
  );
  let timer: unknown = null;
  let running = false;
  let lastSoilUpdate = now();

  const emit = (message: WireMessage) => {
    for (const listener of listeners) listener(message);
  };

  const seconds = () => now() / 1000;

  const tick = () => {
    const t = now();
    const dt = (t - lastSoilUpdate) / 1000;
    lastSoilUpdate = t;
    state.soil = state.pumpOn
      ? Math.min(95, state.soil + 1.6 * dt)
      : Math.max(8, state.soil - 0.012 * dt);
    state.chamber += (state.setpoints.heater - state.chamber) * (1 - Math.exp(-dt / HEATER_LAG));
    const previous = state.psu.mode;
    state.psu = psuOutput(
      state.psuOn,
      state.setpoints["psu-v"],
      state.setpoints["psu-i"],
      loadOhms(seconds()),
    );
    if (state.psu.mode !== previous && state.psu.mode !== "OFF" && previous !== "OFF") {
      const text =
        state.psu.mode === "CC"
          ? `psu: current limit, CC at ${state.setpoints["psu-i"]} A`
          : "psu: back in CV";
      emit({ log: text, lvl: state.psu.mode === "CC" ? "warn" : "info", t: seconds() });
    }

    const commandsLate = t - state.robot.lastDrive > DRIVE_WATCHDOG_MS;
    const moving = Math.abs(state.robot.v) > 0.01 || Math.abs(state.robot.w) > 0.01;
    if (commandsLate && moving && !state.robot.watchdogTripped && state.robot.driveOn) {
      state.robot.watchdogTripped = true;
      emit({
        log: "watchdog: drive commands stopped, slowing to a halt",
        lvl: "warn",
        t: seconds(),
      });
    }
    state.robot = stepRobot(
      state.robot,
      { v: state.setpoints.linear, w: state.setpoints.angular },
      dt,
      t,
    );

    for (const sensor of sensors) {
      const sample: WireSample = {
        ch: sensor.info.id,
        v: round(sensor.read(seconds(), state), 2),
        u: sensor.info.u,
        t: seconds(),
      };
      latest[sample.ch] = sample;
      emit(sample);
    }
    const mode: WireSample = { ch: "psu-mode", v: state.psu.mode, t: seconds() };
    latest[mode.ch] = mode;
    emit(mode);

    if (rand() < 0.03) {
      emit({ log: `sensor sweep ok (${sensors.length} ch)`, lvl: "debug", t: seconds() });
    }

    if (running) timer = schedule(tick, sampleInterval);
  };

  const ackFor = (command: WireCommand, ok: boolean, err?: string): WireAck => ({
    ack: command.n,
    ok,
    id: command.id,
    v: command.v,
    ...(err ? { err } : {}),
    t: seconds(),
  });

  const send = (command: WireCommand) => {
    const latency = ackLatency[0] + rand() * (ackLatency[1] - ackLatency[0]);

    if (command.cmd === "ping") {
      schedule(() => emit(ackFor(command, true)), latency);
      return;
    }

    const actuator = command.id ? actuatorState.get(command.id) : undefined;
    if (!actuator) {
      schedule(() => emit(ackFor(command, false, "unknown id")), latency);
      return;
    }

    if (command.cmd === "get") {
      schedule(() => emit({ ...ackFor(command, true), v: actuator.confirmed }), latency);
      return;
    }

    if (
      command.id === "drive" &&
      command.cmd === "set" &&
      toBoolean(command.v) &&
      state.robot.estop
    ) {
      schedule(() => emit(ackFor(command, false, "e-stop engaged")), latency);
      return;
    }
    // Drive velocities and the dimmer stream many times a second: they apply on arrival, are
    // acknowledged without a log line each, and a lost one is simply replaced by the next.
    const streamed = command.id !== undefined && STREAMED.has(command.id);
    if (command.id === "linear" || command.id === "angular") {
      state.robot.lastDrive = now();
      state.robot.watchdogTripped = false;
    }

    const info = actuators.find((a) => a.id === command.id);
    const target =
      info?.kind === "setpoint" ? clampTo(Number(command.v), info) : toBoolean(command.v);
    actuator.commanded = target;
    actuator.pending = true;

    if (rand() < faultRate) {
      if (!streamed) {
        emit({ log: `${command.id}: command ${command.n} dropped`, lvl: "warn", t: seconds() });
      }
      actuator.pending = false;
      return;
    }

    if (streamed && typeof target === "number" && command.id) {
      state.setpoints[command.id] = target;
      actuator.confirmed = target;
      actuator.pending = false;
      schedule(() => emit({ ...ackFor(command, true), v: target }), latency);
      return;
    }

    schedule(() => {
      actuator.confirmed = target;
      actuator.pending = false;
      if (command.id === "pump") state.pumpOn = target === true;
      if (command.id === "psu-out") state.psuOn = target === true;
      if (command.id === "drive") state.robot.driveOn = target === true;
      if (command.id === "estop") {
        state.robot.estop = target === true;
        if (state.robot.estop) {
          state.robot = { ...state.robot, driveOn: false, v: 0, w: 0 };
          const drive = actuatorState.get("drive");
          if (drive) drive.confirmed = false;
          emit({ ch: "drive", v: false, t: seconds() });
          emit({ log: "estop: engaged, drive disabled", lvl: "error", t: seconds() });
        } else {
          emit({ log: "estop: reset, drive stays off until enabled", lvl: "info", t: seconds() });
        }
      }
      if (typeof target === "number" && command.id) state.setpoints[command.id] = target;
      // The ack carries the value the device applied, which may be clamped.
      emit({ ...ackFor(command, true), v: target });
      const text =
        typeof target === "number" ? `${target} ${info?.u ?? ""}`.trim() : target ? "on" : "off";
      emit({ log: `${command.id} ${text}`, lvl: "info", t: seconds() });
    }, latency);
  };

  const channels: WireChannelInfo[] = [
    ...sensors.map((s) => s.info),
    ...actuators,
    ...Object.keys(waveforms).map((id) => ({ id, u: "V", kind: "waveform" as const })),
  ];

  return {
    channels,
    get running() {
      return running;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    send,
    start() {
      if (running) return;
      running = true;
      lastSoilUpdate = now();
      emit({ hello: WIRE_VERSION, dev: "benchcn-mock", chs: channels, t: seconds() });
      emit({ log: "boot: benchcn mock device", lvl: "info", t: seconds() });
      tick();
    },
    stop() {
      running = false;
      if (timer !== null) cancel(timer);
      timer = null;
    },
    readings: () => ({ ...latest }),
    actuator: (id) => {
      const a = actuatorState.get(id);
      return a ? { ...a } : undefined;
    },
    waveform(ch, t0, n, sampleRate) {
      const spec = waveforms[ch];
      const out = new Float32Array(n);
      if (!spec) return out;
      const wrand = createRandom(seed ^ Math.floor(t0));
      for (let i = 0; i < n; i += 1) {
        const tSec = (t0 + (i * 1000) / sampleRate) / 1000;
        out[i] = spec.offset + spec.amp * waveSample(spec.kind, tSec * spec.freq, wrand);
      }
      return out;
    },
  };
}

function clampTo(value: number, info: WireChannelInfo): number {
  const safe = Number.isFinite(value) ? value : (info.min ?? 0);
  return Math.min(info.max ?? safe, Math.max(info.min ?? safe, safe));
}

function toBoolean(v: WireValue | undefined): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  return v === "on" || v === "true" || v === "1";
}

function round(value: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}
