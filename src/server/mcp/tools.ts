import "server-only";

import { z } from "zod";
import type {
  JsonSchema,
  ParameterDescriptor,
  PrimitiveType,
} from "@/lib/openapi/types";

const MAX_TOOL_NAME = 64;
const MAX_RESULT_CHARS = 48_000;

/** MCP tool names: letters, digits, underscore, hyphen. */
export function sanitizeToolName(operationKey: string): string {
  const cleaned = operationKey
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  const base = cleaned || "operation";
  return base.slice(0, MAX_TOOL_NAME);
}

export function toolDescription(op: {
  summary: string | null;
  description: string | null;
  method: string;
  path: string;
}): string {
  const text =
    op.summary?.trim() ||
    op.description?.trim() ||
    `${op.method.toUpperCase()} ${op.path}`;
  return text.slice(0, 500);
}

function zodForPrimitive(type: PrimitiveType, required: boolean) {
  let schema:
    | z.ZodString
    | z.ZodNumber
    | z.ZodBoolean
    | z.ZodUnknown
    | z.ZodArray<z.ZodUnknown>
    | z.ZodRecord<z.ZodString, z.ZodUnknown> = z.unknown();

  switch (type) {
    case "string":
      schema = z.string();
      break;
    case "integer":
      schema = z.number().int();
      break;
    case "number":
      schema = z.number();
      break;
    case "boolean":
      schema = z.boolean();
      break;
    case "array":
      schema = z.array(z.unknown());
      break;
    case "object":
      schema = z.record(z.string(), z.unknown());
      break;
    default:
      schema = z.unknown();
  }

  return required ? schema : schema.optional();
}

function zodFromJsonSchema(schema: JsonSchema | null | undefined): z.ZodTypeAny {
  if (!schema) return z.unknown().optional();

  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;

  if (schema.enum && schema.enum.length > 0) {
    const values = schema.enum.map((v) => String(v));
    if (values.length === 1) {
      return z.literal(values[0]!);
    }
    return z.enum(values as [string, ...string[]]);
  }

  switch (type) {
    case "string":
      return z.string();
    case "integer":
      return z.number().int();
    case "number":
      return z.number();
    case "boolean":
      return z.boolean();
    case "array":
      return z.array(zodFromJsonSchema(schema.items));
    case "object": {
      if (!schema.properties || Object.keys(schema.properties).length === 0) {
        return z.record(z.string(), z.unknown());
      }
      const shape: Record<string, z.ZodTypeAny> = {};
      const required = new Set(schema.required ?? []);
      for (const [key, prop] of Object.entries(schema.properties)) {
        const field = zodFromJsonSchema(prop);
        shape[key] = required.has(key) ? field : field.optional();
      }
      return z.object(shape);
    }
    default:
      return z.unknown();
  }
}

/**
 * Build a Zod input object for an Operation: one field per OpenAPI parameter,
 * plus optional `body` when a request schema exists.
 */
export function buildToolInputSchema(
  params: ParameterDescriptor[],
  requestSchema: unknown | null,
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const param of params) {
    if (param.looksLikeCredential) continue;
    const field = zodForPrimitive(param.type, param.required);
    shape[param.name] = param.description
      ? field.describe(param.description)
      : field;
  }

  if (requestSchema && typeof requestSchema === "object") {
    const bodySchema = zodFromJsonSchema(requestSchema as JsonSchema);
    shape.body = bodySchema.optional().describe("JSON request body");
  }

  return z.object(shape);
}

export function splitToolArgs(
  args: Record<string, unknown>,
): { params: Record<string, unknown>; body: unknown } {
  const { body, ...params } = args;
  return { params, body };
}

export function formatToolResult(payload: unknown): string {
  let text: string;
  try {
    text = JSON.stringify(payload, null, 2);
  } catch {
    text = String(payload);
  }
  if (text.length <= MAX_RESULT_CHARS) return text;
  return `${text.slice(0, MAX_RESULT_CHARS)}\n…[truncated]`;
}

/** Ensure unique MCP tool names; on collision suffix with connection slug. */
export function uniqueToolNames(
  operations: {
    id: string;
    operationKey: string;
    connectionSlug?: string;
  }[],
): Map<string, string> {
  const used = new Set<string>();
  const map = new Map<string, string>();

  for (const op of operations) {
    let name = sanitizeToolName(op.operationKey);
    if (used.has(name)) {
      const slugPart = op.connectionSlug
        ? sanitizeToolName(op.connectionSlug)
        : op.id.slice(-6);
      const suffix = `_${slugPart}`;
      name = `${name.slice(0, MAX_TOOL_NAME - suffix.length)}${suffix}`;
      if (used.has(name)) {
        const idSuffix = `_${op.id.slice(-6)}`;
        name = `${name.slice(0, MAX_TOOL_NAME - idSuffix.length)}${idSuffix}`;
      }
    }
    used.add(name);
    map.set(op.id, name);
  }

  return map;
}
