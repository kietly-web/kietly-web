import { readFile } from "node:fs/promises";
import path from "node:path";

const typeOf = (v) => (Array.isArray(v) ? "array" : v === null ? "null" : Number.isInteger(v) ? "integer" : typeof v);
const matchesType = (v, t) => typeOf(v) === t || (t === "number" && typeof v === "number");

function resolve(schema, root) {
  if (!schema?.$ref) return schema;
  const target = schema.$ref.replace(/^#\//, "").split("/").reduce((node, key) => node[key], root);
  return { ...target, ...schema, $ref: undefined };
}

function validate(value, schema, root, at, errors) {
  schema = resolve(schema, root);
  const where = at || "(root)";
  const hint = schema.description ? ` — ${schema.description}` : "";

  if (schema.anyOf) {
    const ok = schema.anyOf.some((s) => {
      const sub = [];
      validate(value, s, root, at, sub);
      return sub.length === 0;
    });
    if (!ok) {
      const names = schema.anyOf.flatMap((s) => s.enum ?? []);
      errors.push(`${where}: ${JSON.stringify(value)} is not a known section${names.length ? ` (${names.join(", ")})` : ""} or a { "heading", "markdown" } object`);
    }
    return;
  }
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${where}: must be one of ${schema.enum.map((e) => JSON.stringify(e)).join(", ")} (got ${JSON.stringify(value)})`);
    return;
  }
  if (schema.type && !matchesType(value, schema.type)) {
    errors.push(`${where}: must be ${schema.type} (got ${typeOf(value)})${hint}`);
    return;
  }
  if (typeof value === "string") {
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${where}: ${JSON.stringify(value)} does not match ${schema.pattern}${hint}`);
    if (schema.minLength != null && value.length < schema.minLength) errors.push(`${where}: must not be empty${hint}`);
    if (schema.maxLength != null && value.length > schema.maxLength) errors.push(`${where}: ${value.length} characters, max ${schema.maxLength}${hint}`);
  }
  if (typeof value === "number") {
    if (schema.minimum != null && value < schema.minimum) errors.push(`${where}: must be ≥ ${schema.minimum}`);
    if (schema.maximum != null && value > schema.maximum) errors.push(`${where}: must be ≤ ${schema.maximum}`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems != null && value.length < schema.minItems) errors.push(`${where}: needs at least ${schema.minItems} items${hint}`);
    if (schema.maxItems != null && value.length > schema.maxItems) errors.push(`${where}: allows at most ${schema.maxItems} items${hint}`);
    if (schema.items) value.forEach((item, i) => validate(item, schema.items, root, `${at}[${i}]`, errors));
  }
  if (typeOf(value) === "object") {
    for (const key of schema.required ?? []) if (!(key in value)) errors.push(`${at ? `${at}.` : ""}${key}: is required`);
    for (const [key, v] of Object.entries(value)) {
      const child = schema.properties?.[key];
      const childAt = at ? `${at}.${key}` : key;
      if (child) validate(v, child, root, childAt, errors);
      else if (schema.additionalProperties === false) {
        const known = Object.keys(schema.properties ?? {}).filter((k) => k !== "$schema");
        errors.push(`${childAt}: unknown key (allowed: ${known.join(", ")})`);
      }
    }
  }
}

function withDefaults(value, schema, root) {
  schema = resolve(schema, root);
  if (value === undefined && "default" in schema) value = structuredClone(schema.default);
  if (typeOf(value) === "object" && schema.properties) {
    const out = { ...value };
    for (const [key, child] of Object.entries(schema.properties)) {
      const filled = withDefaults(out[key], child, root);
      if (filled !== undefined) out[key] = filled;
    }
    return out;
  }
  if (Array.isArray(value) && schema.items && !schema.items.anyOf) return value.map((item) => withDefaults(item, schema.items, root));
  return value;
}

export async function loadConfig(root) {
  const file = path.join(root, "profile.config.json");
  const schema = JSON.parse(await readFile(path.join(root, "profile.config.schema.json"), "utf8"));
  let raw;
  try {
    raw = JSON.parse(await readFile(file, "utf8"));
  } catch (err) {
    throw new Error(`profile.config.json is not valid JSON: ${err.message}`);
  }

  const errors = [];
  validate(raw, schema, schema, "", errors);
  if (errors.length) throw new Error(`profile.config.json has ${errors.length} problem(s):\n  - ${errors.join("\n  - ")}`);

  const config = withDefaults(raw, schema, schema);
  config.about.variable ??= config.name.split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9_$]/g, "") || "me";
  return config;
}
