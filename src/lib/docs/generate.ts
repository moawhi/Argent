import { analyzeResponse, extractFields } from "@/lib/openapi/infer";
import { sampleForParameter, sampleFromSchema } from "@/lib/openapi/sample";
import type {
  FieldDescriptor,
  JsonSchema,
  ParameterDescriptor,
  ResponseShape,
} from "@/lib/openapi/types";
import { humanizeKey, titleFromPath } from "@/lib/utils";

export interface OperationLike {
  id: string;
  operationKey: string;
  method: string;
  path: string;
  summary: string | null;
  description: string | null;
  tags: string[];
  params: unknown;
  requestSchema: unknown;
  requestContentType: string | null;
  responseSchema: unknown;
  successStatus: string | null;
  source: string;
  deprecated: boolean;
}

export interface OperationDoc {
  id: string;
  operationKey: string;
  method: string;
  path: string;
  title: string;
  /** One sentence in plain language, e.g. "Returns a list of accounts." */
  plainSummary: string;
  description: string | null;
  tags: string[];
  params: ParameterDescriptor[];
  pathParams: ParameterDescriptor[];
  queryParams: ParameterDescriptor[];
  headerParams: ParameterDescriptor[];
  /** Parameters Argent fills in automatically from saved credentials. */
  credentialParams: ParameterDescriptor[];
  requestFields: FieldDescriptor[];
  requestExample: string | null;
  response: ResponseShape;
  responseExample: string | null;
  successStatus: string | null;
  deprecated: boolean;
  source: string;
}

export function parseParams(raw: unknown): ParameterDescriptor[] {
  if (!Array.isArray(raw)) return [];
  return raw as ParameterDescriptor[];
}

/**
 * Turns an operation into a sentence a non-developer can act on, e.g.
 * "Returns a list of campaigns." or "Updates one account group."
 */
export function plainSummaryFor(
  method: string,
  path: string,
  response: ResponseShape,
): string {
  const subject = titleFromPath(path).toLowerCase();
  const hasPathParam = /\{[^}]+\}/.test(path);

  switch (method.toUpperCase()) {
    case "GET":
      if (response.kind === "binary") return `Downloads a file of ${subject}.`;
      if (response.kind === "collection") return `Returns a list of ${subject}.`;
      return hasPathParam
        ? `Returns one ${singular(subject)} by its ID.`
        : `Returns ${subject}.`;
    case "POST":
      return `Creates a new ${singular(subject)}.`;
    case "PUT":
      return `Replaces an existing ${singular(subject)}.`;
    case "PATCH":
      return `Updates part of an existing ${singular(subject)}.`;
    case "DELETE":
      return `Permanently removes a ${singular(subject)}.`;
    default:
      return `Calls ${method.toUpperCase()} ${path}.`;
  }
}

function singular(word: string): string {
  if (word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.endsWith("sses")) return word.slice(0, -2);
  if (word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

export function buildOperationDoc(
  operation: OperationLike,
  options: { credentialNames?: Set<string> } = {},
): OperationDoc {
  const params = parseParams(operation.params);
  const credentialNames = options.credentialNames ?? new Set<string>();

  const isCredential = (param: ParameterDescriptor) =>
    credentialNames.has(`${param.in}:${param.name}`) ||
    Boolean(param.looksLikeCredential);

  const visible = params.filter((param) => !isCredential(param));

  const requestSchema = (operation.requestSchema as JsonSchema | null) ?? null;
  const responseSchema =
    (operation.responseSchema as JsonSchema | null) ?? null;

  const response = analyzeResponse(responseSchema);
  const requestSample = requestSchema ? sampleFromSchema(requestSchema) : null;
  const responseSample = responseSchema
    ? sampleFromSchema(responseSchema)
    : null;

  return {
    id: operation.id,
    operationKey: operation.operationKey,
    method: operation.method,
    path: operation.path,
    title: operation.summary?.trim() || `${operation.method} ${operation.path}`,
    plainSummary: plainSummaryFor(operation.method, operation.path, response),
    description: operation.description,
    tags: operation.tags,
    params,
    pathParams: visible.filter((param) => param.in === "path"),
    queryParams: visible.filter((param) => param.in === "query"),
    headerParams: visible.filter((param) => param.in === "header"),
    credentialParams: params.filter(isCredential),
    requestFields: extractFields(requestSchema),
    requestExample: requestSample
      ? JSON.stringify(requestSample, null, 2)
      : null,
    response,
    responseExample: responseSample
      ? JSON.stringify(responseSample, null, 2)
      : null,
    successStatus: operation.successStatus,
    deprecated: operation.deprecated,
    source: operation.source,
  };
}

/**
 * A copyable curl command. Credential parameters are shown as named
 * placeholders rather than real values.
 */
export function buildCurl(doc: OperationDoc, baseUrl: string): string {
  let path = doc.path;
  for (const param of doc.pathParams) {
    path = path.replace(`{${param.name}}`, sampleForParameter(param) || "1");
  }

  const query = new URLSearchParams();
  for (const param of doc.credentialParams) {
    if (param.in === "query") query.set(param.name, `$${param.name.toUpperCase()}`);
  }
  for (const param of doc.queryParams) {
    if (!param.required) continue;
    query.set(param.name, sampleForParameter(param));
  }

  const search = query.toString();
  // URLSearchParams escapes the `$` placeholders; put them back for readability.
  const readable = search.replace(/%24/g, "$");
  const url = `${baseUrl.replace(/\/+$/, "")}${path}${readable ? `?${readable}` : ""}`;

  const lines = [`curl -X ${doc.method} "${url}"`];

  for (const param of doc.credentialParams) {
    if (param.in === "header") {
      lines.push(`  -H "${param.name}: $${param.name.toUpperCase()}"`);
    }
  }

  if (doc.requestExample) {
    lines.push(`  -H "Content-Type: application/json"`);
    lines.push(`  -d '${doc.requestExample.replace(/\n\s*/g, " ")}'`);
  }

  return lines.join(" \\\n");
}

/** Groups operations under their first tag, for the docs table of contents. */
export function groupByTag<T extends { tags: string[] }>(
  operations: T[],
): { tag: string; operations: T[] }[] {
  const groups = new Map<string, T[]>();

  for (const operation of operations) {
    const tag = operation.tags[0] ?? "Uncategorized";
    const list = groups.get(tag);
    if (list) list.push(operation);
    else groups.set(tag, [operation]);
  }

  return [...groups.entries()]
    .map(([tag, ops]) => ({ tag, operations: ops }))
    .sort((a, b) => a.tag.localeCompare(b.tag));
}

export function tagSlug(tag: string): string {
  return tag
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function describeParam(param: ParameterDescriptor): string {
  if (param.description?.trim()) return param.description.trim();

  const label = humanizeKey(param.name);
  if (param.enumValues?.length) {
    return `${label}. One of: ${param.enumValues.join(", ")}.`;
  }
  return label;
}
