import { CATALOG, type Expr, type Header, widgetAttrs, widgetHeader } from "./catalog";
import { controlsFor, defaultOf } from "./controls";
import { DEFAULT_WEBSOCKET_URL, type PropLiteral, type StudioState, type Widget } from "./model";

/** `installed` matches what `shadcn add` writes into a project; `registry` is this repo's layout. */
export type ImportStyle = "installed" | "registry";

export type GeneratedDashboard = {
  code: string;
  /** Registry items the file imports from, for one `shadcn add`. */
  items: string[];
};

const PRINT_WIDTH = 100;

type Module = { path: string; item: string };

const LIB = {
  actuator: { path: "registry/benchcn/lib/actuator", item: "actuator" },
  wire: { path: "registry/benchcn/lib/wire", item: "wire" },
  instrument: { path: "registry/benchcn/lib/instrument", item: "instrument" },
  mock: { path: "registry/benchcn/hooks/use-mock-device", item: "use-mock-device" },
  websocket: { path: "registry/benchcn/hooks/use-websocket-source", item: "use-websocket-source" },
  strip: { path: "registry/benchcn/hooks/use-strip-series", item: "strip-chart" },
} satisfies Record<string, Module>;

const componentModule = (type: string): Module => ({
  path: `registry/benchcn/ui/${type}/${type}`,
  item: type,
});

/** Where `shadcn add` puts a registry file, the same rule `scripts/registry-test.mts` checks. */
export function importPath(path: string, style: ImportStyle): string {
  if (style === "registry") return `@/${path}`;
  const base = path.split("/").pop() ?? path;
  if (path.startsWith("registry/benchcn/ui/")) return `@/components/ui/${base}`;
  if (path.startsWith("registry/benchcn/hooks/")) return `@/hooks/${base}`;
  return `@/lib/${base}`;
}

const HELPERS = {
  numberOf: [
    "function numberOf(sample: WireSample | undefined): number | null {",
    '  return sample && typeof sample.v === "number" ? sample.v : null;',
    "}",
  ],
  timeOf: [
    "function timeOf(sample: WireSample | undefined): number | undefined {",
    "  return sample?.t === undefined ? undefined : sample.t * 1000;",
    "}",
  ],
  consoleLines: [
    "function consoleLines(logs: WireLog[]): ConsoleLine[] {",
    "  return logs.map((log, i) => ({ id: i, text: log.log, level: log.lvl, t: log.t }));",
    "}",
  ],
  sendLine: [
    "function sendLine(send: (message: WireMessage) => void, line: string): void {",
    "  const message = parseLine(line);",
    "  if (message && isCommand(message)) send(message);",
    "}",
  ],
} as const;

type Helper = keyof typeof HELPERS;

type Field = "readings" | "history" | "actuators" | "setpoints" | "logs" | "command" | "send";

const FIELD_ORDER: Field[] = [
  "readings",
  "history",
  "actuators",
  "setpoints",
  "logs",
  "command",
  "send",
];

const KEYWORDS = new Set(
  (
    "break case catch class const continue debugger default delete do else enum export extends " +
    "false finally for function if import in instanceof new null return super switch this throw " +
    "true try typeof var void while with yield let static implements interface package private " +
    "protected public await async of undefined"
  ).split(" "),
);

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

function access(object: string, key: string): string {
  return IDENTIFIER.test(key) && !KEYWORDS.has(key)
    ? `${object}.${key}`
    : `${object}[${JSON.stringify(key)}]`;
}

function camel(id: string): string {
  const words = id.split(/[^A-Za-z0-9]+/).filter(Boolean);
  const name = words
    .map((word, i) => (i === 0 ? word.charAt(0).toLowerCase() + word.slice(1) : cap(word)))
    .join("");
  return /^[A-Za-z]/.test(name) ? name : `ch${cap(name)}`;
}

const cap = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

class Context {
  readonly imports = new Map<string, { module: Module; values: Set<string>; types: Set<string> }>();
  readonly fields = new Set<Field>();
  readonly helpers = new Set<Helper>();
  readonly locals: { key: string; name: string; code: string }[] = [];
  readonly taken = new Set<string>([
    "source",
    "Dashboard",
    ...FIELD_ORDER,
    ...Object.keys(HELPERS),
    "INITIAL_ACTUATOR_STATE",
    "InstrumentFrame",
  ]);
  usesSource = false;

  value(module: Module, name: string): void {
    this.entry(module).values.add(name);
  }

  type(module: Module, name: string): void {
    this.entry(module).types.add(name);
  }

  private entry(module: Module) {
    let entry = this.imports.get(module.path);
    if (!entry) {
      entry = { module, values: new Set(), types: new Set() };
      this.imports.set(module.path, entry);
    }
    return entry;
  }

  helper(name: Helper): void {
    this.helpers.add(name);
    if (name === "numberOf" || name === "timeOf") this.type(LIB.wire, "WireSample");
    if (name === "consoleLines") {
      this.type(LIB.wire, "WireLog");
      this.type(componentModule("serial-console"), "ConsoleLine");
      this.fields.add("logs");
    }
    if (name === "sendLine") {
      this.type(LIB.wire, "WireMessage");
      this.value(LIB.wire, "parseLine");
      this.value(LIB.wire, "isCommand");
    }
  }

  local(key: string, preferred: string, code: (name: string) => string): string {
    const existing = this.locals.find((l) => l.key === key);
    if (existing) return existing.name;
    let name = KEYWORDS.has(preferred) ? `${preferred}State` : preferred;
    for (let n = 2; this.taken.has(name); n++) name = `${preferred}${n}`;
    this.taken.add(name);
    this.locals.push({ key, name, code: code(name) });
    return name;
  }
}

function printExpr(expr: Expr, ctx: Context): string {
  switch (expr.op) {
    case "number": {
      ctx.fields.add("readings");
      ctx.helper("numberOf");
      const call = `numberOf(${access("readings", expr.id)})`;
      return expr.fallback === undefined ? call : `${call} ?? ${JSON.stringify(expr.fallback)}`;
    }
    case "sample":
      ctx.fields.add("readings");
      return access("readings", expr.id);
    case "history":
      ctx.fields.add("history");
      return access("history", expr.id);
    case "time":
      ctx.fields.add("readings");
      ctx.helper("timeOf");
      return `timeOf(${access("readings", expr.id)})`;
    case "confirmedOn":
      ctx.fields.add("actuators");
      return `${access("actuators", expr.id)}?.confirmed === true`;
    case "state":
      return stateLocal(expr.map, expr.id, ctx);
    case "field":
      return `${stateLocal(expr.map, expr.id, ctx)}.${expr.field}`;
    case "command":
      ctx.fields.add("command");
      return `(${expr.param}) => command(${JSON.stringify(expr.id)}, ${expr.param})`;
    case "stream":
      ctx.fields.add("send");
      ctx.value(LIB.wire, "setCommand");
      return `(value) => send(setCommand(${JSON.stringify(expr.id)}, value))`;
    case "series":
      ctx.usesSource = true;
      ctx.value(LIB.strip, "useStripSeries");
      return ctx.local(
        `series:${expr.ids.join("\u0000")}`,
        "series",
        (name) =>
          `const ${name} = useStripSeries(source, [${expr.ids.map((id) => JSON.stringify(id)).join(", ")}]);`,
      );
    case "source":
      ctx.usesSource = true;
      return "source";
    case "lines":
      ctx.helper("consoleLines");
      return "consoleLines(logs)";
    case "sendLine":
      ctx.fields.add("send");
      ctx.helper("sendLine");
      return "(line) => sendLine(send, line)";
    case "readout":
      ctx.fields.add("readings");
      ctx.helper("numberOf");
      return `numberOf(${access("readings", expr.id)})?.toFixed(${expr.digits}) ?? "--"`;
  }
}

function stateLocal(map: "actuators" | "setpoints", id: string, ctx: Context): string {
  ctx.fields.add(map);
  ctx.value(LIB.actuator, "INITIAL_ACTUATOR_STATE");
  return ctx.local(
    `${map}:${id}`,
    camel(id),
    (name) => `const ${name} = ${access(map, id)} ?? INITIAL_ACTUATOR_STATE;`,
  );
}

type PrintedAttr = { inline: string; block?: (indent: string) => string[] };

function literalAttr(name: string, value: PropLiteral): PrintedAttr | null {
  if (typeof value === "boolean") return { inline: value ? name : `${name}={false}` };
  if (typeof value === "number") return { inline: `${name}={${value}}` };
  if (typeof value === "string") {
    return {
      inline: /^[^"\\\r\n]*$/.test(value)
        ? `${name}="${value}"`
        : `${name}={${JSON.stringify(value)}}`,
    };
  }
  const entries = Object.entries(value);
  if (entries.length === 0) return null;
  const fields = entries.map(([key, v]) => `${key}: ${v}`);
  return {
    inline: `${name}={{ ${fields.join(", ")} }}`,
    block: (indent) => [
      `${indent}${name}={{`,
      ...fields.map((field) => `${indent}  ${field},`),
      `${indent}}}`,
    ],
  };
}

function sameValue(a: PropLiteral | undefined, b: PropLiteral | undefined): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Props written out for a widget: required ones, and any that differ from the default. */
export function literalProps(widget: Widget): [string, PropLiteral][] {
  const entry = CATALOG[widget.type];
  return controlsFor(widget.type, entry.editable).flatMap((control): [string, PropLiteral][] => {
    if (entry.headerOnly?.includes(control.name)) return [];
    const value = widget.props[control.name];
    if (value === undefined) return [];
    if (typeof value === "string" && value === "" && !control.required) return [];
    if (typeof value === "object" && Object.keys(value).length === 0) return [];
    if (!control.required && sameValue(value, defaultOf(control))) return [];
    return [[control.name, value]];
  });
}

function printElement(name: string, attrs: PrintedAttr[], indent: string): string[] {
  const single = `${indent}<${name}${attrs.map((a) => ` ${a.inline}`).join("")} />`;
  if (single.length <= PRINT_WIDTH) return [single];
  const inner = `${indent}  `;
  return [
    `${indent}<${name}`,
    ...attrs.flatMap((attr) =>
      `${inner}${attr.inline}`.length > PRINT_WIDTH && attr.block
        ? attr.block(inner)
        : [`${inner}${attr.inline}`],
    ),
    `${indent}/>`,
  ];
}

function printWidget(widget: Widget, ctx: Context, indent: string): string[] {
  const entry = CATALOG[widget.type];
  ctx.value(componentModule(widget.type), entry.component);
  const span = `md:col-span-${widget.span}`;
  const attrs: PrintedAttr[] = [];
  if (!entry.inline) attrs.push({ inline: `className="${span}"` });
  for (const [name, value] of literalProps(widget)) {
    const printed = literalAttr(name, value);
    if (printed) attrs.push(printed);
  }
  for (const attr of widgetAttrs(widget)) {
    attrs.push(
      "spread" in attr
        ? { inline: `{...${printExpr(attr.spread, ctx)}}` }
        : { inline: `${attr.name}={${printExpr(attr.expr, ctx)}}` },
    );
  }
  if (!entry.inline) return printElement(entry.component, attrs, indent);
  ctx.value(LIB.instrument, "InstrumentFrame");
  const header = widgetHeader(widget);
  const inner = `${indent}  `;
  return [
    `${indent}<InstrumentFrame className="${header ? `items-start ${span}` : `justify-center ${span}`}">`,
    ...(header ? printHeader(header, ctx, inner) : []),
    ...printElement(entry.component, attrs, inner),
    `${indent}</InstrumentFrame>`,
  ];
}

const HEADER_ROW = "flex w-full items-center justify-between gap-3";
export const HEADER_TITLE = "text-sm font-medium";
export const HEADER_READING = "text-muted-foreground text-sm tabular-nums";

/** JSX text, or an expression when the text has characters JSX would read as markup. */
function jsxText(text: string): string {
  return /^[^{}<>"\\]*$/.test(text) && text.trim() === text ? text : `{${JSON.stringify(text)}}`;
}

function printSpan(className: string, children: string, indent: string): string[] {
  const line = `${indent}<span className="${className}">${children}</span>`;
  if (line.length <= PRINT_WIDTH) return [line];
  return [`${indent}<span className="${className}">`, `${indent}  ${children}`, `${indent}</span>`];
}

function printHeader(header: Header, ctx: Context, indent: string): string[] {
  const inner = `${indent}  `;
  const reading = header.reading
    ? `{${printExpr(header.reading, ctx)}}${header.unit ? ` ${jsxText(header.unit)}` : ""}`
    : null;
  return [
    `${indent}<div className="${HEADER_ROW}">`,
    ...printSpan(HEADER_TITLE, jsxText(header.title), inner),
    ...(reading ? printSpan(HEADER_READING, reading, inner) : []),
    `${indent}</div>`,
  ];
}

/** Breaks a statement the way the formatter would when it runs past the print width. */
function statement(line: string, indent: string): string[] {
  const full = `${indent}${line}`;
  if (full.length <= PRINT_WIDTH) return [full];
  const hugged = /^(.*\(.*?, )\[(.*)\]\);$/.exec(line);
  if (hugged) {
    const items = hugged[2].split(", ");
    return [
      `${indent}${hugged[1]}[`,
      ...items.map((item) => `${indent}  ${item},`),
      `${indent}]);`,
    ];
  }
  const call = /^(const \w+ = \w+)\((.*)\);$/.exec(line);
  if (call) return [`${indent}${call[1]}(`, `${indent}  ${call[2]},`, `${indent});`];
  const assign = /^(const \S+ =) (.*)$/.exec(line);
  if (assign) return [`${indent}${assign[1]}`, `${indent}  ${assign[2]}`];
  return [full];
}

function destructure(fields: Field[], from: string, indent: string): string[] {
  const line = `${indent}const { ${fields.join(", ")} } = ${from};`;
  if (line.length <= PRINT_WIDTH) return [line];
  return [`${indent}const {`, ...fields.map((f) => `${indent}  ${f},`), `${indent}} = ${from};`];
}

function printImport(path: string, values: string[], types: string[]): string[] {
  const typeOnly = values.length === 0;
  const names = [...values, ...types.map((t) => (typeOnly ? t : `type ${t}`))].sort((a, b) =>
    sortKey(a) < sortKey(b) ? -1 : 1,
  );
  const head = typeOnly ? "import type" : "import";
  const line = `${head} { ${names.join(", ")} } from "${path}";`;
  if (line.length <= PRINT_WIDTH) return [line];
  return [`${head} {`, ...names.map((n) => `  ${n},`), `} from "${path}";`];
}

const sortKey = (name: string) => name.replace(/^type /, "").toLowerCase();

export function generateDashboard(
  state: StudioState,
  style: ImportStyle = "installed",
): GeneratedDashboard {
  const ctx = new Context();
  const hook = state.source.kind === "mock" ? LIB.mock : LIB.websocket;
  const hookName = state.source.kind === "mock" ? "useMockDevice" : "useWebSocketSource";
  ctx.value(hook, hookName);
  const hookCall =
    state.source.kind === "mock"
      ? "useMockDevice()"
      : `useWebSocketSource(${JSON.stringify(state.source.url || DEFAULT_WEBSOCKET_URL)})`;

  const body =
    state.widgets.length === 0
      ? []
      : state.widgets.flatMap((widget) => printWidget(widget, ctx, "      "));

  const fields = FIELD_ORDER.filter((field) => ctx.fields.has(field));
  const setup: string[] = [];
  if (ctx.usesSource) {
    setup.push(...statement(`const source = ${hookCall};`, "  "));
    if (fields.length > 0) setup.push(...destructure(fields, "source", "  "));
  } else if (fields.length > 0) {
    const direct = destructure(fields, hookCall, "  ");
    if (direct.length === 1) setup.push(...direct);
    else {
      setup.push(...statement(`const source = ${hookCall};`, "  "));
      setup.push(...destructure(fields, "source", "  "));
    }
  } else {
    setup.push(`  ${hookCall};`);
  }
  for (const local of ctx.locals) setup.push(...statement(local.code, "  "));

  const grid = '<div className="grid gap-4 md:grid-cols-12"';
  const jsx =
    body.length === 0
      ? [`  return ${grid} />;`]
      : ["  return (", `    ${grid}>`, ...body, "    </div>", "  );"];

  const imports = [...ctx.imports.values()]
    .map((entry) => ({ ...entry, path: importPath(entry.module.path, style) }))
    .sort((a, b) => (a.path < b.path ? -1 : 1));

  const lines = [
    'import type { ReactElement } from "react";',
    "",
    ...imports.flatMap((entry) => printImport(entry.path, [...entry.values], [...entry.types])),
    "",
    "export function Dashboard(): ReactElement {",
    ...setup,
    "",
    ...jsx,
    "}",
    ...(Object.keys(HELPERS) as Helper[])
      .filter((name) => ctx.helpers.has(name))
      .flatMap((name) => ["", ...HELPERS[name]]),
    "",
  ];

  const items = [...new Set(imports.map((entry) => entry.module.item))].sort();
  return { code: lines.join("\n"), items };
}

export const PACKAGE_RUNNERS = [
  { id: "pnpm", run: "pnpm dlx" },
  { id: "npm", run: "npx" },
  { id: "yarn", run: "yarn dlx" },
  { id: "bun", run: "bunx --bun" },
] as const;

export function installCommand(
  items: readonly string[],
  runner: string,
  namespace: string,
): string {
  return `${runner} shadcn@latest add ${items.map((item) => `${namespace}/${item}`).join(" ")}`;
}
