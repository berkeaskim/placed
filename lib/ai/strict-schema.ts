/**
 * OpenAI structured outputs (used by the Codex CLI's --output-schema) run in strict mode: every object lists all of its
 * properties in `required` and sets `additionalProperties: false`. A Zod `.optional()` field becomes "required but
 * nullable" here, and dropOptionalNulls() turns the model's nulls back into absent keys before the Zod parse.
 */
type Json = Record<string, unknown>;

const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);

/** Keywords strict mode rejects or that carry no meaning for the model. */
const DROP = new Set(["$schema", "default", "$id"]);

function allowsNull(s: Json): boolean {
  if (s.type === "null" || (Array.isArray(s.type) && s.type.includes("null"))) return true;
  const alts = (s.anyOf ?? s.oneOf) as unknown;
  return Array.isArray(alts) && alts.some((a) => isObj(a) && allowsNull(a));
}

export function toStrictSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toStrictSchema);
  if (!isObj(schema)) return schema;
  const out: Json = {};
  for (const [k, v] of Object.entries(schema)) {
    if (DROP.has(k)) continue;
    if (k === "oneOf") out.anyOf = toStrictSchema(v); // strict mode supports anyOf only
    else if (k === "properties" && isObj(v)) out.properties = Object.fromEntries(Object.entries(v).map(([p, s]) => [p, toStrictSchema(s)]));
    else out[k] = toStrictSchema(v);
  }
  if (isObj(out.properties)) {
    const props = out.properties as Json;
    const required = new Set(Array.isArray(schema.required) ? (schema.required as string[]) : []);
    for (const [p, s] of Object.entries(props)) {
      if (!required.has(p) && isObj(s) && !allowsNull(s)) props[p] = { anyOf: [s, { type: "null" }] };
    }
    out.required = Object.keys(props);
    out.additionalProperties = false;
  }
  return out;
}

/** Removes null values the model returned for keys the original (non-strict) schema left optional. */
export function dropOptionalNulls(value: unknown, schema: unknown): unknown {
  if (!isObj(schema)) return value;
  if (Array.isArray(value)) return isObj(schema.items) ? value.map((v) => dropOptionalNulls(v, schema.items)) : value;
  if (!isObj(value)) return value;
  const alts = (schema.anyOf ?? schema.oneOf) as unknown;
  if (Array.isArray(alts) && !isObj(schema.properties)) {
    // Pick the object alternative whose properties cover this value best.
    const objAlt = alts.filter(isObj).find((a) => isObj(a.properties) && Object.keys(value).every((k) => k in (a.properties as Json)));
    return objAlt ? dropOptionalNulls(value, objAlt) : value;
  }
  if (!isObj(schema.properties)) return value;
  const props = schema.properties as Json;
  const required = new Set(Array.isArray(schema.required) ? (schema.required as string[]) : []);
  const out: Json = {};
  for (const [k, v] of Object.entries(value)) {
    if (v === null && !required.has(k) && !(isObj(props[k]) && allowsNull(props[k] as Json))) continue;
    out[k] = dropOptionalNulls(v, props[k]);
  }
  return out;
}
