import { humanizeKey } from "@/lib/utils";
import type {
  FieldDescriptor,
  JsonSchema,
  PrimitiveType,
  ResponseShape,
  SemanticType,
} from "./types";

/* ------------------------------------------------------------------ *
 * Schema helpers
 * ------------------------------------------------------------------ */

/**
 * Collapses `allOf` / `oneOf` / `anyOf` into a single object schema so the rest
 * of the pipeline only has to deal with one shape. For unions we take the first
 * branch that carries properties, which is the right guess for the
 * "T or null" and "T or ErrorResponse" patterns that dominate real specs.
 */
export function flattenSchema(
  schema: JsonSchema | null | undefined,
  seen = new Set<JsonSchema>(),
): JsonSchema | null {
  if (!schema || typeof schema !== "object") return null;
  if (seen.has(schema)) return null;
  seen.add(schema);

  if (schema.allOf?.length) {
    const merged: JsonSchema = { type: "object", properties: {}, required: [] };
    for (const branch of schema.allOf) {
      const flat = flattenSchema(branch, seen);
      if (!flat) continue;
      Object.assign(merged.properties!, flat.properties ?? {});
      merged.required!.push(...(flat.required ?? []));
      if (flat.type && !merged.type) merged.type = flat.type;
    }
    // Fields declared alongside allOf still apply.
    Object.assign(merged.properties!, schema.properties ?? {});
    merged.required!.push(...(schema.required ?? []));
    merged.description ??= schema.description;
    merged.required = [...new Set(merged.required)];
    return merged;
  }

  const union = schema.oneOf ?? schema.anyOf;
  if (union?.length) {
    const candidates = union
      .map((branch) => flattenSchema(branch, seen))
      .filter((branch): branch is JsonSchema => Boolean(branch))
      .filter((branch) => branch.type !== "null");

    const withProps = candidates.find(
      (branch) => branch.properties && Object.keys(branch.properties).length > 0,
    );
    const chosen = withProps ?? candidates[0] ?? null;
    if (chosen) {
      return {
        ...chosen,
        description: schema.description ?? chosen.description,
        nullable: schema.nullable || candidates.length !== union.length,
      };
    }
  }

  return schema;
}

export function schemaType(schema: JsonSchema | null): PrimitiveType {
  if (!schema) return "unknown";

  const raw = Array.isArray(schema.type)
    ? schema.type.find((t) => t !== "null")
    : schema.type;

  switch (raw) {
    case "string":
    case "number":
    case "integer":
    case "boolean":
    case "object":
    case "array":
      return raw;
    default:
      break;
  }

  // OpenAPI documents in the wild often omit `type`.
  if (schema.properties) return "object";
  if (schema.items) return "array";
  if (schema.enum?.length) {
    return typeof schema.enum[0] === "number" ? "number" : "string";
  }
  return "unknown";
}

function isNullable(schema: JsonSchema): boolean {
  if (schema.nullable) return true;
  if (Array.isArray(schema.type)) return schema.type.includes("null");
  return false;
}

/* ------------------------------------------------------------------ *
 * Semantic type inference
 * ------------------------------------------------------------------ */

const CREDENTIAL_RE =
  /^(apiu|apik|api_?user(name)?|api_?key|access_?key|secret(_?key)?|token|auth_?token|bearer|password|passwd|client_?secret|private_?key)$/i;

const PERCENT_RE =
  /(^|_|\b)(rate|percent|pct|percentage|ratio|roi|discount|share|margin)($|_|\b)/i;

const CURRENCY_RE =
  /(^|_|\b)(amount|balance|cost|spend|spent|budget|revenue|price|payout|fee|earned|earnings|profit|credit|debit|cpc|cpm|cpa|bid|terms|threshold)($|_|\b)/i;

const URL_RE = /(^|_|\b)(url|uri|link|href|endpoint|redirect)($|_|\b)/i;
const EMAIL_RE = /(^|_|\b)(email|e_?mail)($|_|\b)/i;
const TIMEZONE_RE = /(^|_|\b)(timezone|tz|time_?zone)($|_|\b)/i;
const COUNTRY_RE = /(^|_|\b)(country|countries|country_?code)($|_|\b)/i;
const ID_RE = /(^|_)id$|Id$|(^|_)ids$|Ids$|(^|_)uuid$/;
const LONG_TEXT_RE = /(^|_|\b)(description|notes?|comment|body|content|message)($|_|\b)/i;
const DATE_ONLY_RE = /(^|_|\b)(date|day|from_?date|to_?date|start_?date|end_?date)($|_|\b)/i;
const DATETIME_RE = /(datetime|timestamp|_?at$|_?time$)/i;

/**
 * Works out how a value should be displayed and edited, from its name, its
 * declared `format`, and its numeric bounds.
 *
 * Order matters. Credentials are checked first so they are never rendered;
 * percentages before currency so `commissionRate` does not become dollars;
 * explicit `format` before name guesses so the spec always wins.
 */
export function inferSemanticType(
  key: string,
  schema: JsonSchema | null,
): SemanticType {
  const name = key ?? "";

  if (CREDENTIAL_RE.test(name)) return "credential";

  if (!schema) return "unknown";

  const type = schemaType(schema);
  const format = schema.format?.toLowerCase();

  if (schema.enum?.length) return "enum";
  if (type === "boolean") return "boolean";

  // The spec's own format declaration is the most reliable signal.
  switch (format) {
    case "date-time":
      return "datetime";
    case "date":
      return "date";
    case "time":
      return "time";
    case "duration":
      return "duration";
    case "email":
      return "email";
    case "uri":
    case "url":
    case "uri-reference":
      return "url";
    case "binary":
    case "byte":
      return "binary";
    case "password":
      return "credential";
    default:
      break;
  }

  if (type === "number" || type === "integer") {
    const boundedAsPercent =
      schema.minimum === 0 && schema.maximum === 100;
    if (boundedAsPercent || PERCENT_RE.test(name)) return "percent";
    if (CURRENCY_RE.test(name)) return "currency";
    if (ID_RE.test(name)) return "id";
    return type === "integer" ? "integer" : "number";
  }

  if (type === "string") {
    if (TIMEZONE_RE.test(name)) return "timezone";
    if (COUNTRY_RE.test(name)) return "country";
    if (EMAIL_RE.test(name)) return "email";
    if (URL_RE.test(name)) return "url";
    if (DATETIME_RE.test(name)) return "datetime";
    if (DATE_ONLY_RE.test(name)) return "date";
    if (ID_RE.test(name)) return "id";
    if (LONG_TEXT_RE.test(name) || (schema.maxLength ?? 0) > 255) {
      return "longText";
    }
    return "text";
  }

  if (type === "object") return "json";
  if (type === "array") return "json";
  return "unknown";
}

/** True for semantic types that can be plotted on a chart's value axis. */
export function isNumericSemantic(semantic: SemanticType): boolean {
  return (
    semantic === "currency" ||
    semantic === "percent" ||
    semantic === "number" ||
    semantic === "integer" ||
    semantic === "duration"
  );
}

/** True for semantic types usable as a chart's time axis. */
export function isTemporalSemantic(semantic: SemanticType): boolean {
  return semantic === "date" || semantic === "datetime";
}

/* ------------------------------------------------------------------ *
 * Field extraction
 * ------------------------------------------------------------------ */

const MAX_DEPTH = 2;

/**
 * Walks an object schema and produces one descriptor per usable field.
 * Nested objects are flattened to dotted paths up to `MAX_DEPTH`, which keeps
 * generated tables readable while still surfacing things like
 * `transaction.amount` from a wrapped create response.
 */
export function extractFields(
  schema: JsonSchema | null | undefined,
  options: { prefix?: string; depth?: number; includeReadOnly?: boolean } = {},
): FieldDescriptor[] {
  const { prefix = "", depth = 0 } = options;
  const flat = flattenSchema(schema);
  if (!flat) return [];

  if (schemaType(flat) === "array") {
    return extractFields(flat.items, options);
  }

  const properties = flat.properties;
  if (!properties) return [];

  const required = new Set(flat.required ?? []);
  const fields: FieldDescriptor[] = [];

  for (const [key, rawChild] of Object.entries(properties)) {
    const child = flattenSchema(rawChild);
    if (!child) continue;
    if (child.writeOnly && options.includeReadOnly !== false) continue;

    const path = prefix ? `${prefix}.${key}` : key;
    const type = schemaType(child);
    const semantic = inferSemanticType(key, child);

    // Recurse one level into plain nested objects rather than showing "[object]".
    if (type === "object" && child.properties && depth < MAX_DEPTH) {
      const nested = extractFields(child, {
        prefix: path,
        depth: depth + 1,
        includeReadOnly: options.includeReadOnly,
      });
      if (nested.length > 0) {
        fields.push(...nested);
        continue;
      }
    }

    fields.push({
      path,
      key,
      label: humanizeKey(key),
      type,
      semantic,
      required: required.has(key),
      nullable: isNullable(child),
      readOnly: Boolean(child.readOnly),
      description: child.description,
      format: child.format,
      enumValues: child.enum
        ?.filter((value) => value !== null && value !== undefined)
        .map((value) => String(value)),
      default: child.default,
      example: child.example,
      minimum: child.minimum,
      maximum: child.maximum,
      exclusiveMinimum:
        typeof child.exclusiveMinimum === "boolean"
          ? child.exclusiveMinimum
          : child.exclusiveMinimum !== undefined,
      maxLength: child.maxLength,
      depth,
    });
  }

  return fields;
}

/* ------------------------------------------------------------------ *
 * Response shape analysis
 * ------------------------------------------------------------------ */

/** Property names that commonly wrap the real payload. */
const ENVELOPE_KEYS = [
  "stats",
  "data",
  "items",
  "results",
  "records",
  "rows",
  "list",
  "content",
  "entries",
  "values",
];

/**
 * True when `schema` is a map whose values are arrays of objects
 * (`additionalProperties: { type: array, items: { type: object } }`),
 * as on the traffic-provider report's `stats` field.
 */
export function keyedArrayMapItemSchema(
  schema: JsonSchema | null | undefined,
): JsonSchema | null {
  const flat = flattenSchema(schema);
  if (!flat || schemaType(flat) !== "object") return null;

  const additional =
    typeof flat.additionalProperties === "object"
      ? flattenSchema(flat.additionalProperties)
      : null;
  if (!additional || schemaType(additional) !== "array") return null;

  const item = flattenSchema(additional.items);
  if (!item || schemaType(item) !== "object") return null;
  return item;
}

function looksLikeDateKey(key: string): boolean {
  return /^\d{4}-\d{2}-\d{2}/.test(key);
}

/**
 * Name for the synthetic column that holds each map key when a date-keyed
 * (or otherwise keyed) array map is flattened into rows.
 */
export function mapKeyFieldName(
  propertyKey: string,
  propertySchema: JsonSchema | null | undefined,
): string {
  const flat = flattenSchema(propertySchema);
  const description = flat?.description ?? "";
  if (/date|YYYY-MM-DD/i.test(description)) return "date";

  const example = flat?.example;
  if (example && typeof example === "object" && !Array.isArray(example)) {
    const keys = Object.keys(example as Record<string, unknown>);
    if (keys.length > 0 && keys.every(looksLikeDateKey)) return "date";
  }

  // Sample report envelopes use `stats` as a date → rows map.
  if (propertyKey === "stats") return "date";
  return "key";
}

function syntheticKeyField(keyField: string): FieldDescriptor {
  const isDate = keyField === "date";
  return {
    path: keyField,
    key: keyField,
    label: humanizeKey(keyField),
    type: "string",
    semantic: isDate ? "date" : "text",
    required: true,
    nullable: false,
    readOnly: false,
    format: isDate ? "date" : undefined,
    depth: 0,
  };
}

/**
 * Decides whether a response is a list and, if so, where the list lives.
 *
 * Handles the patterns in the sample spec:
 *   - a bare array at the root                       -> rowsPath ""
 *   - `{ fromDate, toDate, timezone, stats: [...] }` -> rowsPath "stats"
 *   - `{ …, stats: { "2025-01-01": [ … ] } }`        -> rowsPath "stats" (keyed map)
 *   - a single object                                -> rowsPath null
 */
export function analyzeResponse(
  schema: JsonSchema | null | undefined,
  contentType?: string,
): ResponseShape {
  const flat = flattenSchema(schema);

  if (!flat) {
    return {
      kind: "empty",
      rowsPath: null,
      fields: [],
      envelopeFields: [],
      contentType,
    };
  }

  if (flat.format === "binary" || contentType?.startsWith("application/pdf")) {
    return {
      kind: "binary",
      rowsPath: null,
      fields: [],
      envelopeFields: [],
      contentType,
    };
  }

  const type = schemaType(flat);

  if (type === "array") {
    const item = flattenSchema(flat.items);
    const fields = extractFields(item);
    return {
      kind: fields.length > 0 ? "collection" : "scalar",
      rowsPath: "",
      fields,
      envelopeFields: [],
      contentType,
    };
  }

  if (type === "object" && flat.properties) {
    const entries = Object.entries(flat.properties);

    // Prefer a well-known envelope key, then fall back to the first array of
    // objects, then to any array at all.
    const byName = entries.find(
      ([key, value]) =>
        ENVELOPE_KEYS.includes(key) && schemaType(flattenSchema(value)) === "array",
    );
    const byObjectArray = entries.find(([, value]) => {
      const child = flattenSchema(value);
      if (schemaType(child) !== "array") return false;
      const item = flattenSchema(child?.items);
      return schemaType(item) === "object";
    });
    const arrayEntry = byName ?? byObjectArray;

    if (arrayEntry) {
      const [key, rawValue] = arrayEntry;
      const arraySchema = flattenSchema(rawValue);
      const fields = extractFields(flattenSchema(arraySchema?.items));
      const envelopeFields = extractFields(flat).filter(
        (field) => field.path !== key && !field.path.startsWith(`${key}.`),
      );
      return {
        kind: "collection",
        rowsPath: key,
        fields,
        envelopeFields,
        contentType,
      };
    }

    // `{ stats: { "2025-01-01": [ {…}, {…} ] } }` — map of arrays, not an array.
    const byKeyedMapName = entries.find(
      ([key, value]) =>
        ENVELOPE_KEYS.includes(key) && Boolean(keyedArrayMapItemSchema(value)),
    );
    const byKeyedMap = entries.find(([, value]) =>
      Boolean(keyedArrayMapItemSchema(value)),
    );
    const keyedEntry = byKeyedMapName ?? byKeyedMap;

    if (keyedEntry) {
      const [key, rawValue] = keyedEntry;
      const itemSchema = keyedArrayMapItemSchema(rawValue);
      const keyField = mapKeyFieldName(key, flattenSchema(rawValue));
      const itemFields = extractFields(itemSchema);
      const fields = [
        syntheticKeyField(keyField),
        ...itemFields.filter((field) => field.path !== keyField),
      ];
      const envelopeFields = extractFields(flat).filter(
        (field) => field.path !== key && !field.path.startsWith(`${key}.`),
      );
      return {
        kind: "collection",
        rowsPath: key,
        fields,
        envelopeFields,
        contentType,
      };
    }

    const fields = extractFields(flat);
    return {
      kind: fields.length > 0 ? "object" : "unknown",
      rowsPath: null,
      fields,
      envelopeFields: [],
      contentType,
    };
  }

  return {
    kind: type === "unknown" ? "unknown" : "scalar",
    rowsPath: null,
    fields: [],
    envelopeFields: [],
    contentType,
  };
}

/**
 * Picks a stable identifier column for a row, used for React keys and for
 * feeding a selected row into a linked form.
 */
export function pickRowIdField(fields: FieldDescriptor[]): string | null {
  const idField = fields.find(
    (field) => field.semantic === "id" && /id$/i.test(field.key),
  );
  if (idField) return idField.path;

  const anyId = fields.find((field) => field.semantic === "id");
  if (anyId) return anyId.path;

  return fields[0]?.path ?? null;
}

/**
 * Chooses sensible default columns for a generated table: keep it under a dozen,
 * lead with the identifier and name, and drop long free text which wrecks the
 * layout.
 */
export function pickDefaultColumns(
  fields: FieldDescriptor[],
  limit = 10,
): string[] {
  const scored = fields
    .filter((field) => field.type !== "array" && field.semantic !== "json")
    .map((field) => {
      let score = 0;
      if (field.semantic === "id") score += 6;
      if (/name|title|label/i.test(field.key)) score += 8;
      if (field.semantic === "currency") score += 5;
      if (field.semantic === "percent") score += 4;
      if (isTemporalSemantic(field.semantic)) score += 4;
      if (field.semantic === "enum") score += 3;
      if (field.semantic === "boolean") score += 2;
      if (isNumericSemantic(field.semantic)) score += 3;
      if (field.semantic === "longText") score -= 6;
      if (field.depth > 0) score -= 3;
      if (field.required) score += 1;
      return { field, score };
    })
    .sort((a, b) => b.score - a.score);

  const chosen = scored.slice(0, limit).map((entry) => entry.field.path);

  // Preserve the schema's own ordering so the table reads like the API docs.
  return fields
    .filter((field) => chosen.includes(field.path))
    .map((field) => field.path);
}
