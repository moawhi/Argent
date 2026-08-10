import { flattenSchema, schemaType } from "./infer";
import type { JsonSchema, ParameterDescriptor } from "./types";

/**
 * Builds a plausible example value for a schema, used for documentation
 * snippets and to pre-fill the request body editor.
 *
 * Prefers whatever the spec supplies (`example`, `default`, the first `enum`
 * member) and only invents a value as a last resort.
 */
export function sampleFromSchema(
  schema: JsonSchema | null | undefined,
  key = "",
  depth = 0,
): unknown {
  const flat = flattenSchema(schema);
  if (!flat || depth > 5) return null;

  if (flat.example !== undefined) return flat.example;
  if (flat.default !== undefined) return flat.default;
  if (flat.enum?.length) return flat.enum[0];
  if (flat.const !== undefined) return flat.const;

  const type = schemaType(flat);

  switch (type) {
    case "array": {
      const item = sampleFromSchema(flat.items, key, depth + 1);
      return item === null ? [] : [item];
    }
    case "object": {
      const out: Record<string, unknown> = {};
      for (const [childKey, childSchema] of Object.entries(
        flat.properties ?? {},
      )) {
        out[childKey] = sampleFromSchema(childSchema, childKey, depth + 1);
      }
      return out;
    }
    case "boolean":
      return true;
    case "integer":
      return exampleNumber(key, flat, true);
    case "number":
      return exampleNumber(key, flat, false);
    case "string":
      return exampleString(key, flat);
    default:
      return null;
  }
}

function clampToBounds(value: number, schema: JsonSchema): number {
  let out = value;
  if (schema.minimum !== undefined) out = Math.max(out, schema.minimum);
  if (schema.maximum !== undefined) out = Math.min(out, schema.maximum);
  return out;
}

function exampleNumber(
  key: string,
  schema: JsonSchema,
  integer: boolean,
): number {
  if (/id$/i.test(key)) return clampToBounds(1, schema);
  if (/(rate|percent|discount|roi)/i.test(key)) return clampToBounds(20, schema);
  if (/(amount|balance|cost|spend|budget|price|earned)/i.test(key)) {
    return clampToBounds(integer ? 100 : 49.99, schema);
  }
  if (/(limit|count|total|redirects|bids)/i.test(key)) {
    return clampToBounds(20, schema);
  }
  return clampToBounds(integer ? 1 : 1.5, schema);
}

function exampleString(key: string, schema: JsonSchema): string {
  switch (schema.format) {
    case "date":
      return new Date().toISOString().slice(0, 10);
    case "date-time":
      return new Date().toISOString();
    case "email":
      return "name@example.com";
    case "uri":
    case "url":
      return "https://example.com";
    case "uuid":
      return "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
    default:
      break;
  }

  if (/timezone/i.test(key)) return "UTC";
  if (/country/i.test(key)) return "US";
  if (/(^|_)(url|link)/i.test(key)) return "https://example.com";
  if (/email/i.test(key)) return "name@example.com";
  if (/name$/i.test(key)) return "Example name";
  if (/(description|notes?)/i.test(key)) return "Optional note";
  if (/date/i.test(key)) return new Date().toISOString().slice(0, 10);

  return "string";
}

/** An example value for a parameter, for docs and Try-it prefills. */
export function sampleForParameter(param: ParameterDescriptor): string {
  if (param.example !== undefined && param.example !== null) {
    return String(param.example);
  }
  if (param.default !== undefined && param.default !== null) {
    return String(param.default);
  }
  if (param.enumValues?.length) return param.enumValues[0];

  const sample = sampleFromSchema(
    {
      type: param.type === "unknown" ? "string" : param.type,
      format: param.format,
      minimum: param.minimum,
      maximum: param.maximum,
    },
    param.name,
  );

  return sample === null ? "" : String(sample);
}
