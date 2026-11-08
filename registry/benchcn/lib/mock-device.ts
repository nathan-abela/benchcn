// benchcn.dev · mock-device
// A simulated bench: slow sensors, a relay and a heater setpoint with acknowledgement latency,
// waveform channels and
// log lines, all speaking the wire protocol. Deterministic for a given seed, so demos and tests
// behave the same every run.
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
  /** Heater setpoint and the chamber temperature that follows it. */
  setpoint: number;
  chamber: number;
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
];

const actuators: WireChannelInfo[] = [
  { id: "pump", kind: "actuator", label: "Water pump" },
  { id: "led", kind: "actuator", label: "Status LED" },
  { id: "heater", kind: "setpoint", u: "°C", min: 15, max: 35, label: "Heater setpoint" },
];

const HEATER_START = 20;
/** Seconds for the chamber to close about two thirds of the gap to the setpoint. */
const HEATER_LAG = 8;

const waveforms: Record<string, { kind: WaveformKind; freq: number; amp: number; offset: number }> =
  {
    ch1: { kind: "sine", freq: 1000, amp: 1.0, offset: 0 },
    ch2: { kind: "square", freq: 1000, amp: 1.65, offset: 1.65 },
    ch3: { kind: "triangle", freq: 500, amp: 0.5, offset: 0 },
    ch4: { kind: "noise", freq: 0, amp: 0.05, offset: 0 },
  };

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
    setpoint: HEATER_START,
    chamber: HEATER_START,
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
        confirmed: a.kind === "setpoint" ? HEATER_START : false,
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
    state.chamber += (state.setpoint - state.chamber) * (1 - Math.exp(-dt / HEATER_LAG));

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

    const info = actuators.find((a) => a.id === command.id);
    const target =
      info?.kind === "setpoint" ? clampTo(Number(command.v), info) : toBoolean(command.v);
    actuator.commanded = target;
    actuator.pending = true;

    if (rand() < faultRate) {
      emit({ log: `${command.id}: command ${command.n} dropped`, lvl: "warn", t: seconds() });
      actuator.pending = false;
      return;
    }

    schedule(() => {
      actuator.confirmed = target;
      actuator.pending = false;
      if (command.id === "pump") state.pumpOn = target === true;
      if (typeof target === "number") state.setpoint = target;
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
