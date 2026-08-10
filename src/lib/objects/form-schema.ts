import { z } from "zod";
import type { FieldValues, Resolver } from "react-hook-form";
import type { FormFieldConfig } from "./types";

export type FormValues = Record<string, unknown>;

/**
 * Builds a Zod schema from the form object's field config.
 *
 * Everything arrives from HTML inputs as a string, so each field parses its own
 * text and reports a message a non-developer can act on.
 */
export function buildFormSchema(fields: FormFieldConfig[]) {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const field of fields) {
    if (!field.visible || field.control === "hidden") continue;
    shape[field.path] = buildFieldSchema(field);
  }

  return z.object(shape);
}

function buildFieldSchema(field: FormFieldConfig): z.ZodTypeAny {
  const label = field.label;

  if (field.control === "checkbox") {
    return z.coerce.boolean();
  }

  if (field.control === "number") {
    let schema = z
      .string()
      .trim()
      .transform((value, ctx) => {
        if (value === "") return undefined;
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) {
          ctx.addIssue({
            code: "custom",
            message: `${label} must be a number.`,
          });
          return z.NEVER;
        }
        return parsed;
      })
      .pipe(
        z
          .number()
          .optional()
          .superRefine((value, ctx) => {
            if (value === undefined) return;
            if (field.min !== undefined && value < field.min) {
              ctx.addIssue({
                code: "custom",
                message: `${label} must be ${field.min} or more.`,
              });
            }
            if (field.max !== undefined && value > field.max) {
              ctx.addIssue({
                code: "custom",
                message: `${label} must be ${field.max} or less.`,
              });
            }
          }),
      );

    if (field.required) {
      schema = schema.pipe(
        z.number({ error: `${label} is required.` }),
      ) as unknown as typeof schema;
    }

    return schema;
  }

  let schema = z.string();

  if (field.required) {
    schema = schema.trim().min(1, `${label} is required.`);
  }

  if (field.control === "select" && field.options?.length) {
    return field.required
      ? z.enum(field.options as [string, ...string[]], {
          error: `Choose a ${label.toLowerCase()}.`,
        })
      : z.string().optional();
  }

  return field.required ? schema : schema.optional();
}

/**
 * A react-hook-form resolver for a Zod schema, written inline so the project
 * does not depend on @hookform/resolvers, whose peer tree conflicts with
 * current Zod releases.
 */
export function zodFormResolver<T extends FieldValues>(
  schema: z.ZodType<unknown>,
): Resolver<T> {
  return async (values) => {
    const result = schema.safeParse(values);

    if (result.success) {
      return { values: result.data as T, errors: {} };
    }

    const errors: Record<string, { type: string; message: string }> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join(".") || "root";
      // Keep the first message per field; later ones are usually noise.
      if (!errors[path]) {
        errors[path] = { type: issue.code ?? "invalid", message: issue.message };
      }
    }

    return { values: {} as T, errors: errors as never };
  };
}

/**
 * Drops empty optional values so a PATCH does not overwrite fields the user
 * never touched, and converts the remaining strings to their real types.
 */
export function cleanFormPayload(
  values: FormValues,
  fields: FormFieldConfig[],
): Record<string, unknown> {
  const byPath = new Map(fields.map((field) => [field.path, field]));
  const payload: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(values)) {
    const field = byPath.get(key);
    if (!field || !field.visible) continue;

    if (value === "" || value === undefined || value === null) {
      if (field.required) payload[key] = value;
      continue;
    }

    if (field.control === "checkbox") {
      payload[key] = Boolean(value);
      continue;
    }

    if (field.control === "number") {
      const parsed = typeof value === "number" ? value : Number(value);
      if (Number.isFinite(parsed)) payload[key] = parsed;
      continue;
    }

    payload[key] = value;
  }

  return payload;
}
