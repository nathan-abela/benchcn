import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createMockDevice } from "@/registry/benchcn/lib/mock-device";
import { registry } from "@/registry/registry";

import { CATALOG, CATALOG_ORDER } from "./catalog";
import { generateDashboard, importPath, installCommand } from "./codegen";
import { controlFor, controlsFor } from "./controls";
import { dropIndex, moveItem, stepSpan, type StudioState } from "./model";
import { buildStudioPrompt } from "./prompt";
import {
  bindSlot,
  createWidget,
  DEFAULT_STATE,
  decodeState,
  encodeState,
  readState,
} from "./state";

const channels = createMockDevice().channels;

function everyWidget(): StudioState {
  const widgets = CATALOG_ORDER.reduce<StudioState["widgets"]>(
    (list, type) => [...list, createWidget(type, channels, list)],
    [],
  );
  const rangeBar = widgets.find((w) => w.type === "range-bar");
  const setpoint = widgets.find((w) => w.type === "setpoint-input");
  if (rangeBar) rangeBar.bind.setpoint = "heater";
  if (setpoint) setpoint.bind.value = "chamber";
  return { v: 1, source: { kind: "mock" }, widgets };
}

describe("layout maths", () => {
  it("moves an item and clamps the target", () => {
    // #given
    const items = ["a", "b", "c", "d"];

    // #when
    const forward = moveItem(items, 0, 2);
    const past = moveItem(items, 3, 10);
    const back = moveItem(items, 3, -4);

    // #then
    expect(forward).toEqual(["b", "c", "a", "d"]);
    expect(past).toEqual(items);
    expect(back).toEqual(["d", "a", "b", "c"]);
  });

  it("steps spans within the allowed range", () => {
    // #when
    const grown = stepSpan(4, 1);
    const capped = stepSpan(12, 1);
    const floored = stepSpan(6, -1, 6);

    // #then
    expect(grown).toBe(6);
    expect(capped).toBe(12);
    expect(floored).toBe(6);
  });

  it("finds the drop index from the pointer, row by row", () => {
    // #given two cards on one row and one below
    const rects = [
      { left: 0, top: 0, width: 100, height: 50 },
      { left: 110, top: 0, width: 100, height: 50 },
      { left: 0, top: 60, width: 210, height: 50 },
    ];

    // #when
    const beforeFirst = dropIndex({ x: 20, y: 20 }, rects);
    const beforeSecond = dropIndex({ x: 130, y: 20 }, rects);
    const afterSecond = dropIndex({ x: 200, y: 20 }, rects);
    const atEnd = dropIndex({ x: 150, y: 100 }, rects);

    // #then
    expect(beforeFirst).toBe(0);
    expect(beforeSecond).toBe(1);
    expect(afterSecond).toBe(2);
    expect(atEnd).toBe(3);
  });
});

describe("controls from the props docs", () => {
  it("reads numbers, booleans, text, choices and threshold objects", () => {
    // #when
    const controls = controlsFor("sensor-tile", ["label", "precision", "thresholds", "state"]);
    const color = controlFor("color", {
      type: '"green" | "blue" | "amber"',
      description: "",
      default: '"green"',
    });
    const flag = controlFor("bezel", { type: "boolean", description: "", default: "true" });

    // #then
    expect(controls.map((c) => c.kind)).toEqual(["text", "number", "numbers", "choice"]);
    expect(controls[2]).toMatchObject({
      keys: ["min", "max", "low", "high", "warnBelow", "warnAbove"],
    });
    expect(color).toMatchObject({
      kind: "choice",
      options: ["green", "blue", "amber"],
      default: "green",
    });
    expect(flag).toMatchObject({ kind: "boolean", default: true });
  });

  it("skips function and array props", () => {
    // #when
    const handler = controlFor("onCommand", { type: "(next: boolean) => void", description: "" });
    const list = controlFor("levels", { type: "WireLogLevel[]", description: "" });

    // #then
    expect(handler).toBeNull();
    expect(list).toBeNull();
  });

  it("finds a control for every editable prop in the catalog", () => {
    // #when
    const missing = CATALOG_ORDER.flatMap((type) => {
      const found = controlsFor(type, CATALOG[type].editable).map((c) => c.name);
      return CATALOG[type].editable
        .filter((name) => !found.includes(name))
        .map((n) => `${type}.${n}`);
    });

    // #then
    expect(missing).toEqual([]);
  });
});

describe("state", () => {
  it("binds a new widget to the first channel not already on the canvas", () => {
    // #given
    const first = createWidget("sensor-tile", channels, []);

    // #when
    const second = createWidget("sensor-tile", channels, [first]);

    // #then
    expect(first.bind.value).toBe("temp");
    expect(first.props).toMatchObject({ label: "Air temperature", unit: "°C" });
    expect(second.bind.value).toBe("humidity");
  });

  it("prefers a channel that fits the component", () => {
    // #when
    const battery = createWidget("battery-indicator", channels, []);
    const signal = createWidget("signal-strength", channels, []);

    // #then
    expect([battery.bind.value, battery.props.unit, signal.bind.value]).toEqual([
      "battery",
      "V",
      "rssi",
    ]);
  });

  it("takes a step of about a hundredth of the setpoint's range", () => {
    // #given
    const limit = channels.find((c) => c.id === "psu-i");

    // #when
    const knob = bindSlot(createWidget("rotary-encoder", channels, []), "setpoint", "psu-i", limit);

    // #then
    expect(knob.props).toMatchObject({ min: 0.05, max: 3, step: 0.01, unit: "A" });
  });

  it("round-trips a layout through a share link", async () => {
    // #given
    const state = everyWidget();

    // #when
    const text = await encodeState(state);
    const back = await decodeState(text);

    // #then
    expect(text).toMatch(/^[\w-]+$/);
    expect(back).toEqual(state);
  });

  it("drops what a crafted link should not carry", () => {
    // #given
    const raw = {
      v: 1,
      source: { kind: "websocket", url: "ws://bench.local" },
      widgets: [
        { id: "a", type: "sensor-tile", span: 4, bind: { value: 'x"); alert(1); ("' }, props: {} },
        { id: "b", type: "nope", span: 4, bind: {}, props: {} },
        {
          id: "c",
          type: "sensor-tile",
          span: 5,
          bind: { value: "temp" },
          props: { label: 3, unit: "°C", onClick: "steal()" },
        },
      ],
    };

    // #when
    const state = readState(raw);

    // #then
    expect(state?.widgets).toEqual([
      {
        id: "c",
        type: "sensor-tile",
        span: 4,
        bind: { value: "temp" },
        props: { unit: "°C", label: "Reading" },
      },
    ]);
    expect(state?.source).toEqual({ kind: "websocket", url: "ws://bench.local" });
  });

  it("rejects anything that is not a version 1 layout", async () => {
    // #when
    const wrongVersion = readState({ v: 2, widgets: [] });
    const garbage = await decodeState("not-a-layout");

    // #then
    expect(wrongVersion).toBeNull();
    expect(garbage).toBeNull();
  });
});

describe("code generation", () => {
  it("imports only what the dashboard uses and lists those items", () => {
    // #given
    const state: StudioState = {
      v: 1,
      source: { kind: "mock" },
      widgets: [createWidget("actuator-control", channels, [])],
    };

    // #when
    const { code, items } = generateDashboard(state);

    // #then
    expect(items).toEqual(["actuator", "actuator-control", "use-mock-device"]);
    expect(code).toContain('import { ActuatorControl } from "@/components/ui/actuator-control";');
    expect(code).toContain("const { actuators, command } = useMockDevice();");
    expect(code).toContain("const pump = actuators.pump ?? INITIAL_ACTUATOR_STATE;");
    expect(code).toContain('onCommand={(next) => command("pump", next)}');
    expect(code).not.toContain("numberOf");
  });

  it("writes only props that differ from their defaults", () => {
    // #given
    const widget = createWidget("status-led", channels, []);
    widget.props = { ...widget.props, pattern: "steady", color: "green" };

    // #when
    const { code } = generateDashboard({ v: 1, source: { kind: "mock" }, widgets: [widget] });

    // #then
    expect(code).toContain('color="green"');
    expect(code).not.toContain("pattern=");
  });

  it("shows the LED bar's label and reading above the bar", () => {
    // #given
    const widget = createWidget("led-bar", channels, []);

    // #when
    const { code } = generateDashboard({ v: 1, source: { kind: "mock" }, widgets: [widget] });

    // #then
    expect(code).toContain('<span className="text-sm font-medium">Air temperature</span>');
    expect(code).toContain('{numberOf(readings.temp)?.toFixed(0) ?? "--"} °C');
  });

  it("shows the seven-segment label as the card title, not to the display", () => {
    // #given
    const widget = createWidget("seven-segment", channels, []);

    // #when
    const { code } = generateDashboard({ v: 1, source: { kind: "mock" }, widgets: [widget] });

    // #then
    expect(code).toContain('<span className="text-sm font-medium">Air temperature</span>');
    expect(code).not.toContain('label="Air temperature"');
  });

  it("connects to the WebSocket URL from the layout", () => {
    // #when
    const { code, items } = generateDashboard({
      ...DEFAULT_STATE,
      source: { kind: "websocket", url: "ws://plant.local/ws" },
    });

    // #then
    expect(code).toContain('const source = useWebSocketSource("ws://plant.local/ws");');
    expect(items).toContain("use-websocket-source");
    expect(items).not.toContain("use-mock-device");
  });

  it("maps every imported file to the item that ships it", () => {
    // #given every file a generated dashboard can import
    const { code } = generateDashboard(everyWidget(), "registry");
    const paths = [...code.matchAll(/from "@\/(registry\/[^"]+)"/g)].map((m) => m[1]);
    const { items } = generateDashboard(everyWidget());

    // #when
    const owners = paths.map((path) => {
      const item = registry.find((i) =>
        i.files?.some((f) => f.path.replace(/\.tsx?$/, "") === path),
      );
      return { path, item: item?.name, installed: importPath(path, "installed") };
    });

    // #then
    expect(owners.filter((o) => o.item === undefined)).toEqual([]);
    expect([...new Set(owners.map((o) => o.item))].sort()).toEqual(items);
    expect(
      owners.find((o) => o.item === "strip-chart" && o.path.includes("hooks"))?.installed,
    ).toBe("@/hooks/use-strip-series");
  });

  it("writes a prompt with the install command, the layout, the channels and the file", () => {
    // #when
    const prompt = buildStudioPrompt(DEFAULT_STATE, channels);

    // #then
    expect(prompt).toContain("shadcn@latest add @benchcn/actuator @benchcn/actuator-control");
    expect(prompt).toContain('- Sensor tile "Air temperature", 4 of 12 columns, reading temp');
    expect(prompt).toContain('- pump "Water pump": actuator');
    expect(prompt).toContain("export function Dashboard(): ReactElement {");
  });

  it("builds one shadcn add command for every item", () => {
    // #when
    const command = installCommand(["sensor-tile", "use-mock-device"], "npx", "@benchcn");

    // #then
    expect(command).toBe("npx shadcn@latest add @benchcn/sensor-tile @benchcn/use-mock-device");
  });

  it("generates code that typechecks and is already formatted", () => {
    // #given dashboards on the repo's import paths
    const dir = join(process.cwd(), ".cache", "studio");
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    const cases: Record<string, StudioState> = {
      "default-dashboard": DEFAULT_STATE,
      "every-widget": everyWidget(),
      "websocket-dashboard": { ...everyWidget(), source: { kind: "websocket", url: "" } },
      "empty-dashboard": { v: 1, source: { kind: "mock" }, widgets: [] },
    };
    const files = Object.entries(cases).map(([name, state]) => {
      const file = join(dir, `${name}.tsx`);
      writeFileSync(file, generateDashboard(state, "registry").code);
      return file;
    });
    writeFileSync(
      join(dir, "tsconfig.json"),
      JSON.stringify({
        extends: "../../tsconfig.json",
        include: ["./*.tsx"],
        compilerOptions: { noUnusedLocals: true, noUnusedParameters: true },
      }),
    );
    const bin = (name: string) => join(process.cwd(), "node_modules", ".bin", name);
    const run = (command: string, args: string[]) => {
      try {
        execFileSync(command, args, { encoding: "utf8", shell: true, stdio: "pipe" });
        return "";
      } catch (error) {
        const { stdout, stderr } = error as { stdout?: string; stderr?: string };
        return `${stdout ?? ""}${stderr ?? ""}`.trim() || String(error);
      }
    };

    // #when
    const typecheck = run(bin("tsc"), ["-p", join(dir, "tsconfig.json")]);
    const format = run(bin("oxfmt"), ["--check", ...files]);

    // #then
    expect(typecheck).toBe("");
    expect(format).toBe("");
  }, 120_000);
});
