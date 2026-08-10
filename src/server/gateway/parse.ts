import "server-only";

import Papa from "papaparse";
import { humanizeKey, getByPath } from "@/lib/utils";
import { inferSemanticType } from "@/lib/openapi/infer";
import type {
  FieldDescriptor,
  PrimitiveType,
  ResponseKind,
} from "@/lib/openapi/types";

export interface ParsedPayload {
  kind: ResponseKind;
  data: unknown;
  rows: Record<string, unknown>[] | null;
  envelope: Record<string, unknown> | null;
  /** Descriptors derived from the values actually returned. */
  fields: FieldDescriptor[];
}

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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" && value !== null && !Array.isArray(value)
  );
}

/**
 * Parses a raw response body. Several AdLogic endpoints answer with CSV under
 * `text/plain` when `format=csv`, so content type alone is not enough; we sniff
 * the body when the declared type is ambiguous.
 */
export function parsePayload(
  raw: string,
  contentType: string | null,
): { data: unknown; usedFormat: "json" | "csv" | "text" } {
  const type = (contentType ?? "").toLowerCase();
  const trimmed = raw.trim();

  if (trimmed.length === 0) {
    return { data: null, usedFormat: "text" };
  }

  const looksJson = trimmed.startsWith("{") || trimmed.startsWith("[");

  if (type.includes("json") || looksJson) {
    try {
      return { data: JSON.parse(trimmed), usedFormat: "json" };
    } catch {
      // Fall through and try the other parsers.
    }
  }

  if (type.includes("csv") || (type.includes("text/plain") && !looksJson)) {
    const result = Papa.parse<Record<string, unknown>>(trimmed, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
    });
    if (result.data.length > 0 && result.meta.fields?.length) {
      return { data: result.data, usedFormat: "csv" };
    }
  }

  return { data: trimmed, usedFormat: "text" };
}

function primitiveTypeOf(value: unknown): PrimitiveType {
  if (value === null || value === undefined) return "unknown";
  if (Array.isArray(value)) return "array";
  switch (typeof value) {
    case "string":
      return "string";
    case "boolean":
      return "boolean";
    case "number":
      return Number.isInteger(value) ? "integer" : "number";
    case "object":
      return "object";
    default:
      return "unknown";
  }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/;

/**
 * Builds field descriptors from real rows. This complements the schema-derived
 * descriptors: it catches fields a spec forgot to document, and it is the only
 * source of truth for CSV responses and manually built requests.
 *
 * Scans up to 50 rows so a null in the first row does not lose a column.
 */
export function inferFieldsFromRows(
  rows: Record<string, unknown>[],
): FieldDescriptor[] {
  const sample = rows.slice(0, 50);
  const seen = new Map<string, FieldDescriptor>();
  const nonNullSeen = new Set<string>();

  for (const row of sample) {
    if (!isPlainObject(row)) continue;

    for (const [key, value] of Object.entries(row)) {
      const type = primitiveTypeOf(value);
      const existing = seen.get(key);

      // Once we have seen a real value for a key, don't let later nulls
      // downgrade the inferred type.
      if (existing && nonNullSeen.has(key)) {
        if (value === null || value === undefined) existing.nullable = true;
        continue;
      }

      if (value === null || value === undefined) {
        if (!existing) {
          seen.set(key, {
            path: key,
            key,
            label: humanizeKey(key),
            type: "unknown",
            semantic: "unknown",
            required: false,
            nullable: true,
            readOnly: false,
            depth: 0,
          });
        } else {
          existing.nullable = true;
        }
        continue;
      }

      nonNullSeen.add(key);

      let semantic = inferSemanticType(key, {
        type: type === "integer" ? "integer" : type,
      });

      // Strings that hold dates are extremely common and rarely declared.
      if (type === "string" && typeof value === "string") {
        if (ISO_DATETIME.test(value)) semantic = "datetime";
        else if (ISO_DATE.test(value)) semantic = "date";
      }

      seen.set(key, {
        path: key,
        key,
        label: humanizeKey(key),
        type,
        semantic,
        required: false,
        nullable: existing?.nullable ?? false,
        readOnly: false,
        example: value,
        depth: 0,
      });
    }
  }

  return [...seen.values()];
}

/**
 * Reduces a parsed payload to rows plus an envelope, using the schema's
 * `rowsPath` when we have one and falling back to structural detection.
 */
export function normalizePayload(
  data: unknown,
  rowsPath: string | null | undefined,
): ParsedPayload {
  if (data === null || data === undefined) {
    return { kind: "empty", data, rows: null, envelope: null, fields: [] };
  }

  if (typeof data === "string" || typeof data === "number" || typeof data === "boolean") {
    return { kind: "scalar", data, rows: null, envelope: null, fields: [] };
  }

  if (Array.isArray(data)) {
    const rows = data.filter(isPlainObject);
    if (rows.length === 0 && data.length > 0) {
      // An array of scalars: wrap each value so it can still fill a table.
      const wrapped = data.map((value) => ({ value }));
      return {
        kind: "collection",
        data,
        rows: wrapped,
        envelope: null,
        fields: inferFieldsFromRows(wrapped),
      };
    }
    return {
      kind: "collection",
      data,
      rows,
      envelope: null,
      fields: inferFieldsFromRows(rows),
    };
  }

  if (!isPlainObject(data)) {
    return { kind: "unknown", data, rows: null, envelope: null, fields: [] };
  }

  // Prefer the path the schema told us about.
  if (rowsPath) {
    const candidate = getByPath(data, rowsPath);
    if (Array.isArray(candidate)) {
      const rows = candidate.filter(isPlainObject);
      const envelope: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data)) {
        if (key !== rowsPath.split(".")[0]) envelope[key] = value;
      }
      return {
        kind: "collection",
        data,
        rows,
        envelope,
        fields: inferFieldsFromRows(rows),
      };
    }

    // Date-keyed (or otherwise keyed) map of row arrays.
    if (isPlainObject(candidate) && isKeyedArrayMap(candidate)) {
      const keyField = inferMapKeyField(Object.keys(candidate), rowsPath);
      const rows = flattenKeyedArrayMap(candidate, keyField);
      const envelope: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data)) {
        if (key !== rowsPath.split(".")[0]) envelope[key] = value;
      }
      return {
        kind: "collection",
        data,
        rows,
        envelope,
        fields: inferFieldsFromRows(rows),
      };
    }
  }

  // Otherwise look for a well-known wrapper, then any array of objects.
  const entries = Object.entries(data);
  const named = entries.find(
    ([key, value]) => ENVELOPE_KEYS.includes(key) && Array.isArray(value),
  );
  const anyArray = entries.find(
    ([, value]) => Array.isArray(value) && value.some(isPlainObject),
  );
  const found = named ?? anyArray;

  if (found) {
    const [key, value] = found;
    const rows = (value as unknown[]).filter(isPlainObject);
    const envelope: Record<string, unknown> = {};
    for (const [k, v] of entries) {
      if (k !== key) envelope[k] = v;
    }
    return {
      kind: "collection",
      data,
      rows,
      envelope,
      fields: inferFieldsFromRows(rows),
    };
  }

  // Structural fallback for `{ stats: { "2025-01-01": [ … ] } }`.
  const namedMap = entries.find(
    ([key, value]) =>
      ENVELOPE_KEYS.includes(key) && isPlainObject(value) && isKeyedArrayMap(value),
  );
  const anyMap = entries.find(
    ([, value]) => isPlainObject(value) && isKeyedArrayMap(value),
  );
  const mapFound = namedMap ?? anyMap;

  if (mapFound) {
    const [key, value] = mapFound;
    const map = value as Record<string, unknown>;
    const keyField = inferMapKeyField(Object.keys(map), key);
    const rows = flattenKeyedArrayMap(map, keyField);
    const envelope: Record<string, unknown> = {};
    for (const [k, v] of entries) {
      if (k !== key) envelope[k] = v;
    }
    return {
      kind: "collection",
      data,
      rows,
      envelope,
      fields: inferFieldsFromRows(rows),
    };
  }

  return {
    kind: "object",
    data,
    rows: null,
    envelope: data,
    fields: inferFieldsFromRows([data]),
  };
}

function isKeyedArrayMap(value: Record<string, unknown>): boolean {
  const values = Object.values(value);
  if (values.length === 0) return false;
  return values.every(
    (entry) => Array.isArray(entry) && entry.every((item) => isPlainObject(item) || item == null),
  );
}

function looksLikeDateKey(key: string): boolean {
  return /^\d{4}-\d{2}-\d{2}/.test(key);
}

function inferMapKeyField(keys: string[], pathHint: string): string {
  if (keys.length > 0 && keys.every(looksLikeDateKey)) return "date";
  const leaf = pathHint.split(".").pop() ?? pathHint;
  if (leaf === "stats" || /date/i.test(leaf)) return "date";
  return "key";
}

/** Turns `{ "2025-01-01": [row, row] }` into rows that each carry the map key. */
function flattenKeyedArrayMap(
  map: Record<string, unknown>,
  keyField: string,
): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  for (const [key, value] of Object.entries(map)) {
    if (!Array.isArray(value)) continue;
    for (const item of value) {
      if (!isPlainObject(item)) continue;
      rows.push({ [keyField]: key, ...item });
    }
  }
  return rows;
}
