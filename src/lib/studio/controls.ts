import { type PropDoc, props as propDocs } from "@/lib/props";

import type { PropLiteral } from "./model";

export type Control =
  | { kind: "number"; name: string; default?: number; required: boolean }
  | { kind: "boolean"; name: string; default: boolean; required: boolean }
  | { kind: "text"; name: string; default?: string; required: boolean }
  | { kind: "choice"; name: string; options: string[]; default?: string; required: boolean }
  | { kind: "numbers"; name: string; keys: string[]; required: boolean };

const QUOTED = /^"([^"]*)"$/;

function parseDefault(raw: string | undefined): PropLiteral | undefined {
  if (raw === undefined) return undefined;
  const text = raw.trim();
  if (text === "true") return true;
  if (text === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text);
  const quoted = QUOTED.exec(text);
  return quoted ? quoted[1] : undefined;
}

/** Builds an editor control from a props doc, or null for types the Studio cannot edit. */
export function controlFor(name: string, doc: PropDoc): Control | null {
  const required = doc.required === true;
  const parts = doc.type
    .split("|")
    .map((part) => part.trim())
    .filter((part) => part !== "null" && part !== "undefined");
  const fallback = parseDefault(doc.default);

  if (parts.length === 1 && parts[0] === "number") {
    return {
      kind: "number",
      name,
      default: typeof fallback === "number" ? fallback : undefined,
      required,
    };
  }
  if (parts.length === 1 && parts[0] === "boolean") {
    return { kind: "boolean", name, default: fallback === true, required };
  }
  if (parts.length === 1 && (parts[0] === "string" || parts[0] === "ReactNode")) {
    return {
      kind: "text",
      name,
      default: typeof fallback === "string" ? fallback : undefined,
      required,
    };
  }
  const literals = parts.filter((part) => QUOTED.test(part));
  const openString = parts.filter((part) => part === "string").length;
  if (literals.length > 0 && literals.length + openString === parts.length) {
    return {
      kind: "choice",
      name,
      options: literals.map((part) => part.slice(1, -1)),
      default: typeof fallback === "string" ? fallback : undefined,
      required,
    };
  }
  const object = /^\{([^{}]*)\}$/.exec(doc.type.trim());
  if (object) {
    const keys = [...object[1].matchAll(/(\w+)\?/g)].map((match) => match[1]);
    if (keys.length > 0 && keys.length === object[1].split(",").length) {
      return { kind: "numbers", name, keys, required };
    }
  }
  return null;
}

/** Editable controls for a component, in the order given. Names the docs lack are skipped. */
export function controlsFor(component: string, names: readonly string[]): Control[] {
  const docs = propDocs[component] ?? {};
  return names.flatMap((name) => {
    const doc = docs[name];
    const control = doc ? controlFor(name, doc) : null;
    return control ? [control] : [];
  });
}

export function defaultOf(control: Control): PropLiteral | undefined {
  return control.kind === "numbers" ? undefined : control.default;
}

/** Whether a value fits a control, for props read back from a shared link. */
export function acceptsValue(control: Control, value: unknown): value is PropLiteral {
  switch (control.kind) {
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "boolean":
      return typeof value === "boolean";
    case "text":
      return typeof value === "string" && value.length <= 200;
    case "choice":
      return typeof value === "string" && control.options.includes(value);
    case "numbers":
      return (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value) &&
        Object.entries(value).every(
          ([key, v]) => control.keys.includes(key) && typeof v === "number" && Number.isFinite(v),
        )
      );
  }
}
