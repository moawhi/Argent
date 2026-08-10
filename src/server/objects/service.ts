import "server-only";

import { prisma } from "@/server/db";
import { analyzeResponse, extractFields } from "@/lib/openapi/infer";
import {
  buildFormConfig,
  suggestObjects,
  type ObjectSuggestion,
} from "@/lib/objects/suggest";
import { credentialNamesFor } from "@/server/operations/queries";
import type {
  FieldDescriptor,
  JsonSchema,
  ParameterDescriptor,
} from "@/lib/openapi/types";
import type { ParamBindings } from "@/lib/gateway/types";
import type { FormFieldConfig, ObjectKind } from "@/lib/objects/types";
import type { Prisma } from "@prisma/client";

export interface BuilderContext {
  operation: {
    id: string;
    operationKey: string;
    method: string;
    path: string;
    summary: string | null;
    tags: string[];
  };
  connection: {
    id: string;
    name: string;
    readOnly: boolean;
  };
  suggestions: ObjectSuggestion[];
  /** Parameters the user must bind, excluding auto-injected credentials. */
  bindableParams: ParameterDescriptor[];
  /** Default bindings, wiring known date parameters to the dashboard filter. */
  defaultBindings: ParamBindings;
  /** Every field a row can contain, so panels can offer the full choice. */
  responseFields: FieldDescriptor[];
  requestFields: FieldDescriptor[];
}

/**
 * Common filter keys that a parameter binds to automatically, so a new chart
 * follows the dashboard date picker without the user wiring anything.
 */
const AUTO_FILTER_BINDINGS: { pattern: RegExp; filterKey: string }[] = [
  { pattern: /^(from_?date|start_?date|since|date_?from)$/i, filterKey: "dateRange.from" },
  { pattern: /^(to_?date|end_?date|until|date_?to)$/i, filterKey: "dateRange.to" },
  { pattern: /^timezone$/i, filterKey: "timezone" },
];

export async function buildBuilderContext(
  operationId: string,
): Promise<BuilderContext | null> {
  const operation = await prisma.operation.findUnique({
    where: { id: operationId },
    include: {
      connection: {
        select: { id: true, name: true, readOnly: true, type: true },
      },
    },
  });

  if (!operation) return null;

  const credentialNames = await credentialNamesFor(operation.connectionId);
  const params = (operation.params as unknown as ParameterDescriptor[]) ?? [];

  const bindableParams = params.filter(
    (param) =>
      !credentialNames.has(`${param.in}:${param.name}`) &&
      !param.looksLikeCredential,
  );

  let response = analyzeResponse(
    operation.responseSchema as JsonSchema | null,
  );

  // SQL queries often have no OpenAPI response schema — sample a few rows.
  if (operation.source === "sql" && operation.sqlTemplate) {
    const sampleParams: Record<string, unknown> = {};
    for (const param of bindableParams) {
      if (/limit|page_?size|take|count/i.test(param.name)) {
        sampleParams[param.name] = 25;
      } else if (/offset|skip|page/i.test(param.name)) {
        sampleParams[param.name] = 0;
      }
    }

    try {
      const { executeSqlOperation } = await import(
        "@/server/database/executor"
      );
      const sample = await executeSqlOperation({
        operationId: operation.id,
        connectionId: operation.connectionId,
        params: sampleParams,
        origin: "test",
        noCache: true,
      });
      if (sample.ok && sample.fields?.length) {
        response = {
          kind: "collection",
          fields: sample.fields,
          rowsPath: "",
          envelopeFields: [],
        };
      } else if (operation.method === "SELECT" || operation.method === "SQL") {
        response = {
          kind: "collection",
          fields: response.fields,
          rowsPath: "",
          envelopeFields: [],
        };
      }
    } catch {
      response = {
        kind: "collection",
        fields: response.fields,
        rowsPath: "",
        envelopeFields: [],
      };
    }
  }

  const requestFields = extractFields(
    operation.requestSchema as JsonSchema | null,
  );

  const suggestions = suggestObjects({
    method:
      operation.source === "sql" &&
      (operation.method === "SELECT" || operation.method === "SQL")
        ? "GET"
        : operation.method,
    path: operation.summary ?? operation.path,
    summary: operation.summary,
    response,
    requestFields,
    hasRequestBody: operation.requestSchema !== null,
  });

  const defaultBindings: ParamBindings = {};
  for (const param of bindableParams) {
    const auto = AUTO_FILTER_BINDINGS.find((entry) =>
      entry.pattern.test(param.name),
    );
    if (auto) {
      defaultBindings[param.name] = { mode: "filter", filterKey: auto.filterKey };
    } else if (param.default !== undefined && param.default !== null) {
      defaultBindings[param.name] = { mode: "static", value: param.default };
    } else if (param.required) {
      defaultBindings[param.name] = { mode: "prompt" };
    } else {
      defaultBindings[param.name] = { mode: "omit" };
    }
  }

  return {
    operation: {
      id: operation.id,
      operationKey: operation.operationKey,
      method: operation.method,
      path: operation.path,
      summary: operation.summary,
      tags: operation.tags,
    },
    connection: operation.connection,
    suggestions,
    bindableParams,
    defaultBindings,
    responseFields: response.fields,
    requestFields,
  };
}

/** Everything the row-action editor needs about the endpoint it will call. */
export interface RowActionTarget {
  operationId: string;
  method: string;
  path: string;
  summary: string | null;
  /** Parameters the author has to fill, credentials excluded. */
  params: ParameterDescriptor[];
  /** Input boxes generated from the request body, for `form` actions. */
  formFields: FormFieldConfig[];
  hasBody: boolean;
}

export async function buildRowActionTarget(
  operationId: string,
): Promise<RowActionTarget | null> {
  const operation = await prisma.operation.findUnique({
    where: { id: operationId },
  });
  if (!operation) return null;

  const credentialNames = await credentialNamesFor(operation.connectionId);
  const params = ((operation.params as unknown as ParameterDescriptor[]) ?? [])
    .filter(
      (param) =>
        !credentialNames.has(`${param.in}:${param.name}`) &&
        !param.looksLikeCredential,
    );

  const requestFields = extractFields(
    operation.requestSchema as JsonSchema | null,
  );

  return {
    operationId: operation.id,
    method: operation.method,
    path: operation.path,
    summary: operation.summary,
    params,
    formFields: buildFormConfig(
      requestFields,
      operation.method,
      operation.summary ?? operation.path,
    ).fields,
    hasBody: operation.requestSchema !== null,
  };
}

export interface SaveObjectInput {
  id?: string;
  connectionId: string;
  operationId: string;
  name: string;
  description?: string;
  kind: ObjectKind;
  config: unknown;
  paramBindings: ParamBindings;
}

export async function saveObject(input: SaveObjectInput) {
  const data = {
    name: input.name.trim(),
    description: input.description?.trim() || null,
    kind: input.kind,
    config: input.config as Prisma.InputJsonValue,
    paramBindings: input.paramBindings as unknown as Prisma.InputJsonValue,
    operationId: input.operationId,
    connectionId: input.connectionId,
  };

  if (input.id) {
    return prisma.dataObject.update({ where: { id: input.id }, data });
  }

  return prisma.dataObject.create({ data });
}

export async function listObjects(connectionId?: string) {
  return prisma.dataObject.findMany({
    where: connectionId ? { connectionId } : undefined,
    orderBy: { updatedAt: "desc" },
    include: {
      connection: { select: { id: true, name: true, readOnly: true } },
      operation: {
        select: { method: true, path: true, summary: true, id: true },
      },
      _count: { select: { widgets: true } },
    },
  });
}

export async function getObject(id: string) {
  return prisma.dataObject.findUnique({
    where: { id },
    include: {
      connection: { select: { id: true, name: true, readOnly: true } },
      operation: true,
    },
  });
}

/**
 * Bulk-creates one object per suggestion for a set of endpoints, used by the
 * "add them all" shortcut after an import.
 */
export async function createObjectsForOperations(
  operationIds: string[],
  kinds: ObjectKind[] = ["table"],
) {
  const created: string[] = [];

  for (const operationId of operationIds) {
    const context = await buildBuilderContext(operationId);
    if (!context) continue;

    const suggestion = context.suggestions.find((entry) =>
      kinds.includes(entry.kind),
    );
    if (!suggestion) continue;

    const object = await saveObject({
      connectionId: context.connection.id,
      operationId,
      name: suggestion.name,
      kind: suggestion.kind,
      config: suggestion.config,
      paramBindings: context.defaultBindings,
    });

    created.push(object.id);
  }

  return created;
}
