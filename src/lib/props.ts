import type { ReactNode } from "react";

export type PropDoc = {
  type: string;
  description: ReactNode;
  default?: string;
  required?: boolean;
};

export type PropsDoc = Record<string, PropDoc>;

const scopeChannel: PropsDoc = {
  id: {
    type: "string",
    description: "Unique channel id, also the trigger source key.",
    required: true,
  },
  data: {
    type: "ArrayLike<number> | () => ArrayLike<number>",
    description:
      "Samples, newest last. Pass a function and the scope pulls fresh samples every frame without re-rendering.",
    required: true,
  },
  sampleRate: { type: "number", description: "Samples per second.", required: true },
  label: { type: "string", description: "Shown in the readout.", default: '"CH1"' },
  color: {
    type: "string",
    description: "Any CSS colour.",
    default: "var(--channel-n, var(--chart-n))",
  },
  unit: { type: "string", description: "Unit for readouts and measurements.", default: '"V"' },
  voltsPerDiv: { type: "number", description: "Vertical scale.", default: "1" },
  offset: {
    type: "number",
    description: "Position of zero, in divisions from the centre.",
    default: "0",
  },
  visible: {
    type: "boolean",
    description: "Hide the trace but keep the channel.",
    default: "true",
  },
};

const scopeTrigger: PropsDoc = {
  source: { type: "string", description: "Channel id to trigger on.", default: "first channel" },
  level: { type: "number", description: "Trigger level in the channel's unit.", default: "0" },
  edge: { type: '"rising" | "falling"', description: "Which crossing fires.", default: '"rising"' },
  mode: {
    type: '"auto" | "normal"',
    description:
      "Auto sweeps freely when nothing triggers; normal holds the last triggered capture.",
    default: '"auto"',
  },
  pretrigger: {
    type: "number",
    description: "Fraction of the screen shown before the trigger point.",
    default: "0.5",
  },
};

export const props: Record<string, PropsDoc> = {
  "bitfield-diagram": {
    fields: {
      type: "Bitfield[]",
      description:
        "`{ name, bits, access?, description?, values?, color? }`; `bits` is a width (LSB first) or `[lsb, msb]`.",
      required: true,
    },
    bits: { type: "number", description: "Register width.", default: "8" },
    value: { type: "number", description: "Current value; decoded per field and shown per bit." },
    onValueChange: {
      type: "(value: number) => void",
      description: "Makes bits clickable to toggle.",
    },
    lanes: { type: "number", description: "Bits per row.", default: "16 above 16 bits" },
    title: { type: "ReactNode", description: "", default: '"Register"' },
    name: { type: "ReactNode", description: "Register name or address." },
    legend: { type: "boolean", description: "Field table under the diagram.", default: "true" },
  },
  "timing-diagram": {
    signals: {
      type: "WaveSignal[]",
      description: "`{ name, wave, data?, period?, phase? }` in WaveJSON notation.",
      required: true,
    },
    hscale: { type: "number", description: "Pixels per cycle.", default: "36" },
    title: { type: "ReactNode", description: "", default: '"Timing"' },
    caption: { type: "ReactNode", description: "Text under the figure." },
    grid: { type: "boolean", description: "Cycle grid lines.", default: "true" },
  },
  "pinout-header": {
    board: {
      type: "BoardDefinition",
      description: "A board export from `@/lib/boards`.",
      required: true,
    },
    headers: { type: "string[]", description: "Header ids to draw.", default: "all" },
    assignments: {
      type: "Assignment[]",
      description: "`{ pin, header?, part, signal?, use? }` for each wire.",
      default: "[]",
    },
    colorBy: {
      type: '"function" | "kind"',
      description: "Bus colours or kind only.",
      default: '"function"',
    },
    functions: {
      type: "boolean",
      description: "Show alternate functions next to names.",
      default: "true",
    },
    title: { type: "ReactNode", description: "Label above the board name.", default: "the vendor" },
    onPinClick: { type: "(pin, header) => void", description: "Makes pins buttons." },
  },
  "character-lcd": {
    lines: {
      type: "string[]",
      description: "Text per row; padded or clipped to `cols`.",
      required: true,
    },
    cols: { type: "number", description: "", default: "16" },
    rows: { type: "number", description: "", default: "2" },
    color: {
      type: '"green" | "blue" | "amber" | "white" | "red"',
      description: "Module colour preset.",
      default: '"green"',
    },
    backlight: { type: "boolean", description: "Dims the glass when off.", default: "true" },
    scale: { type: "number", description: "CSS pixels per LCD pixel.", default: "3" },
    cursor: {
      type: "{ col: number; row: number; blink?: boolean }",
      description: "Underline cursor, optionally a blinking block.",
    },
    customGlyphs: {
      type: "Record<string, number[]>",
      description: "5×8 bitmaps keyed by the character that shows them, like CGRAM.",
    },
    label: { type: "string", description: "Accessible description.", default: "the display text" },
  },
  "serial-console": {
    lines: {
      type: "ConsoleLine[]",
      description: "`{ id?, text, level?, t?, direction? }`; `t` in seconds (epoch or since boot).",
      required: true,
    },
    onCommand: {
      type: "(line: string) => void",
      description: "Shows the input and receives each line.",
    },
    title: { type: "ReactNode", description: "", default: '"Serial console"' },
    status: { type: "ReactNode", description: "Header detail such as the baud rate or URL." },
    timestamps: { type: "boolean", description: "", default: "true" },
    levels: { type: "WireLogLevel[]", description: "Levels to show.", default: "all" },
    placeholder: { type: "string", description: "", default: '"Type a line and press Enter"' },
    height: { type: "number | string", description: "Height of the log area.", default: "240" },
    disabled: { type: "boolean", description: "Disables the input.", default: "false" },
  },
  "status-led": {
    label: {
      type: "ReactNode",
      description: "Accessible name, shown when `showLabel` is set.",
      required: true,
    },
    on: { type: "boolean", description: "", default: "true" },
    color: {
      type: '"red" | "amber" | "green" | "blue" | "white" | string',
      description: "A physical colour preset or any CSS colour.",
      default: "var(--primary)",
    },
    pattern: {
      type: '"steady" | "blink" | "pulse" | "heartbeat"',
      description: "CSS animation; steady under reduced motion.",
      default: '"steady"',
    },
    rate: { type: "number", description: "Blink or pulse rate in hertz.", default: "2" },
    size: { type: '"sm" | "md" | "lg"', description: "8, 12 or 16 px.", default: '"md"' },
    showLabel: {
      type: "boolean",
      description: "Render the label next to the LED.",
      default: "false",
    },
  },
  "seven-segment": {
    value: {
      type: "number | string",
      description: "A number, or a string of digits, letters, `-`, `.`, `:` and spaces.",
      required: true,
    },
    digits: { type: "number", description: "Total positions; shorter values are right aligned." },
    decimals: { type: "number", description: "Fixed decimals for numeric values." },
    leadingZeros: {
      type: "boolean",
      description: "Pad with zeros instead of blanks.",
      default: "false",
    },
    color: {
      type: '"red" | "amber" | "green" | "blue" | "white" | string',
      description: "A physical colour preset or any CSS colour.",
      default: "var(--primary)",
    },
    size: { type: "number", description: "Digit height in pixels.", default: "40" },
    offOpacity: { type: "number", description: "Opacity of unlit segments.", default: "0.09" },
    bezel: {
      type: "boolean",
      description: "Dark display window behind the digits.",
      default: "true",
    },
    label: { type: "string", description: "Accessible description.", default: "the value" },
  },
  "strip-chart": {
    series: {
      type: "{ id, label?, unit?, color?, min?, max?, points }[]",
      description:
        "Series to draw. `points` are `{ t, v }` with `t` in milliseconds, oldest first. `useStripSeries` builds them from any source.",
      required: true,
    },
    title: { type: "ReactNode", description: "", default: '"Trend"' },
    seconds: { type: "number", description: "Width of the visible window.", default: "60" },
    min: {
      type: "number",
      description: "Fixed lower bound for an overlay chart.",
      default: "from the data",
    },
    max: {
      type: "number",
      description: "Fixed upper bound for an overlay chart.",
      default: "from the data",
    },
    layout: {
      type: '"auto" | "overlay" | "stacked"',
      description: "`auto` gives each series its own lane when units differ.",
      default: '"auto"',
    },
    staleAfter: {
      type: "number",
      description: "Milliseconds without a sample before a series is stale and its line breaks.",
      default: "5000",
    },
    height: { type: "number", description: "Plot height in pixels.", default: "200" },
    paused: { type: "boolean", description: "Control pausing from outside." },
    onPausedChange: { type: "(paused: boolean) => void", description: "" },
    exportName: {
      type: "string",
      description: "CSV file name without the extension.",
      default: '"benchcn-trend"',
    },
  },
  "sensor-tile": {
    label: { type: "ReactNode", description: "", required: true },
    value: {
      type: "number | null",
      description: "`null` renders a dash and the No data state.",
      required: true,
    },
    unit: { type: "string", description: "Shown after the value and in the range caption." },
    precision: { type: "number", description: "Decimal places.", default: "by magnitude" },
    thresholds: {
      type: "{ min?, max?, low?, high?, warnBelow?, warnAbove? }",
      description: "Range of the bar and the alarm and warning limits, all in the value's unit.",
    },
    history: {
      type: "ArrayLike<number>",
      description: "Recent values, oldest first, for the sparkline.",
    },
    updatedAt: {
      type: "number",
      description: "Milliseconds timestamp of the value; enables the age and stale check.",
    },
    staleAfter: {
      type: "number",
      description: "Milliseconds before a reading counts as stale.",
      default: "10000",
    },
    state: {
      type: '"ok" | "warn" | "alarm" | "stale" | "unknown"',
      description: "Override the derived state.",
    },
  },
  oscilloscope: {
    channels: {
      type: "ScopeChannel[]",
      description: "One entry per trace. See ScopeChannel below.",
      required: true,
    },
    timebase: {
      type: "number",
      description: "Seconds per horizontal division.",
      default: "0.0002",
    },
    trigger: { type: "ScopeTrigger", description: "See ScopeTrigger below.", default: "{}" },
    persistence: {
      type: "number",
      description:
        "0 clears each frame; up to 1 leaves fading trails. Ignored under reduced motion.",
      default: "0.35",
    },
    running: { type: "boolean", description: "Stop freezes the display.", default: "true" },
    divisions: {
      type: "{ x: number; y: number }",
      description: "Graticule divisions.",
      default: "{ x: 10, y: 8 }",
    },
    onTriggerLevelChange: {
      type: "(level: number) => void",
      description: "Makes the trigger level draggable on the screen.",
    },
    title: { type: "ReactNode", description: "Header label.", default: '"Oscilloscope"' },
    measurements: {
      type: "MeasurementKey[] | false",
      description: "Which automatic measurements to show for the trigger source.",
      default: '["frequency", "period", "peakToPeak", "rms", "mean"]',
    },
  },
  "oscilloscope-channel": scopeChannel,
  "oscilloscope-trigger": scopeTrigger,
  "logic-analyzer": {
    lanes: {
      type: "LogicLane[]",
      description: "`{ id, label?, color?, data, sampleRate }` with data as 0/1 levels.",
      required: true,
    },
    decode: {
      type: '{ protocol: "i2c"; sda: string; scl: string }',
      description: "Lane ids to decode. Frames are drawn above the SDA lane.",
    },
    window: {
      type: "{ start: number; end: number }",
      description: "Visible window in seconds. Omit to let the analyzer manage zoom and pan.",
    },
    onWindowChange: {
      type: "(window) => void",
      description: "Fires on zoom, pan, fit and list clicks.",
    },
    laneHeight: { type: "number", description: "Pixels per lane.", default: "36" },
    list: { type: "boolean", description: "Show the decoded transaction list.", default: "true" },
    title: { type: "ReactNode", description: "Header label.", default: '"Logic analyzer"' },
  },
  "actuator-control": {
    label: { type: "ReactNode", description: "What the actuator is.", required: true },
    description: { type: "ReactNode", description: "Pin, timeout, fail-safe. One line." },
    commanded: {
      type: "boolean | null",
      description: "What the user last asked for.",
      required: true,
    },
    confirmed: {
      type: "boolean | null",
      description: "What the device last acknowledged. `null` until known.",
      required: true,
    },
    pending: { type: "boolean", description: "Waiting for an acknowledgement.", default: "false" },
    error: {
      type: "string | null",
      description: '`"timeout"` or the device\'s error text.',
      default: "null",
    },
    latency: {
      type: "number | null",
      description: "Last round trip in milliseconds.",
      default: "null",
    },
    onCommand: {
      type: "(next: boolean) => void",
      description: "Send the command. Called once per completed hold.",
      required: true,
    },
    holdMs: {
      type: "number",
      description: "Hold time before the command fires. 0 makes it a tap.",
      default: "600",
    },
    disabled: { type: "boolean", description: "", default: "false" },
    labels: {
      type: "{ on?: string; off?: string }",
      description: "Words for the two states.",
      default: '{ on: "On", off: "Off" }',
    },
  },
};
