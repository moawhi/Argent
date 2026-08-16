import "server-only";

import { dereference } from "@scalar/openapi-parser";
import { inferSemanticType, schemaType } from "@/lib/openapi/infer";
import {
  HTTP_METHODS,
  type CredentialCandidate,
  type IngestResult,
  type JsonSchema,
  type NormalizedOperation,
  type ParameterDescriptor,
  type ParameterLocation,
  type SpecServer,
} from "@/lib/openapi/types";

/* ------------------------------------------------------------------ *
 * Loose views of the OpenAPI document, post-dereference.
 * ------------------------------------------------------------------ */

interface RawParameter {
  name?: string;
  in?: string;
  required?: boolean;
  description?: string;
  schema?: JsonSchema;
  example?: unknown;
  deprecated?: boolean;
}

interface RawMediaType {
  schema?: JsonSchema;
  example?: unknown;
}

interface RawBody {
  required?: boolean;
  description?: string;
  content?: Record<string, RawMediaType>;
}

interface RawResponse {
  description?: string;
  content?: Record<string, RawMediaType>;
}

interface RawOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  deprecated?: boolean;
  parameters?: RawParameter[];
  requestBody?: RawBody;
  responses?: Record<string, RawResponse>;
}

type RawPathItem = Record<string, unknown> & {
  parameters?: RawParameter[];
};

interface RawDocument {
  openapi?: string;
  swagger?: string;
  info?: { title?: string; version?: string; description?: string };
  servers?: SpecServer[];
  host?: string;
  basePath?: string;
  schemes?: string[];
  paths?: Record<string, RawPathItem>;
}

/* ------------------------------------------------------------------ *
 * Ingest
 * ------------------------------------------------------------------ */

/** `GET /api/accounts/{id}` -> `get_api_accounts_by_id` */
export function buildOperationKey(method: string, path: string): string {
  const cleaned = path
    .replace(/\{([^}]+)\}/g, "by_$1")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  return `${method.toLowerCase()}_${cleaned || "root"}`;
}

function toParameterLocation(value: string | undefined): ParameterLocation {
  switch (value) {
    case "path":
    case "header":
    case "cookie":
      return value;
    default:
      return "query";
  }
}

function normalizeParameter(raw: RawParameter): ParameterDescriptor | null {
  if (!raw?.name) return null;

  const schema = raw.schema ?? {};
  const location = toParameterLocation(raw.in);
  const semantic = inferSemanticType(raw.name, schema);

  return {
    name: raw.name,
    in: location,
    // Path parameters are always required regardless of what the spec says.
    required: location === "path" ? true : Boolean(raw.required),
    description: raw.description ?? schema.description,
    type: schemaType(schema),
    semantic,
    format: schema.format,
    enumValues: schema.enum
      ?.filter((value) => value !== null && value !== undefined)
      .map((value) => String(value)),
    default: schema.default,
    example: raw.example ?? schema.example,
    minimum: schema.minimum,
    maximum: schema.maximum,
    looksLikeCredential: semantic === "credential",
  };
}

/** Picks the JSON media type when present, otherwise the first one offered. */
function pickMediaType(
  content: Record<string, RawMediaType> | undefined,
): { contentType: string; media: RawMediaType } | null {
  if (!content) return null;

  const keys = Object.keys(content);
  if (keys.length === 0) return null;

  const json =
    keys.find((key) => key === "application/json") ??
    keys.find((key) => key.includes("json"));

  const chosen = json ?? keys[0];
  return { contentType: chosen, media: content[chosen] };
}

/** The 2xx response that best represents a successful call. */
function pickSuccessResponse(
  responses: Record<string, RawResponse> | undefined,
): { status: string; response: RawResponse } | null {
  if (!responses) return null;

  const statuses = Object.keys(responses);
  const success =
    statuses.find((status) => status === "200") ??
    statuses.find((status) => status === "201") ??
    statuses.find((status) => /^2\d\d$/.test(status)) ??
    statuses.find((status) => status.toLowerCase() === "default");

  if (!success) return null;
  return { status: success, response: responses[success] };
}

/**
 * Swagger 2.0 documents describe their base URL with host/basePath/schemes
 * instead of a servers array.
 */
function resolveServers(doc: RawDocument): SpecServer[] {
  if (doc.servers?.length) {
    return doc.servers.filter((server) => Boolean(server?.url));
  }

  if (doc.host) {
    const scheme = doc.schemes?.[0] ?? "https";
    return [{ url: `${scheme}://${doc.host}${doc.basePath ?? ""}` }];
  }

  return [];
}

/**
 * Finds parameters that look like credentials and are required across most of
 * the API, so the connection wizard can offer to store them once instead of
 * asking for them on every object.
 */
export function detectCredentialCandidates(
  operations: NormalizedOperation[],
  minCoverage = 0.4,
): CredentialCandidate[] {
  if (operations.length === 0) return [];

  const counts = new Map<string, CredentialCandidate>();

  for (const operation of operations) {
    for (const param of operation.params) {
      if (!param.required) continue;
      if (param.in !== "query" && param.in !== "header") continue;
      if (!param.looksLikeCredential) continue;

      const id = `${param.in}:${param.name}`;
      const existing = counts.get(id);
      if (existing) {
        existing.occurrences += 1;
      } else {
        counts.set(id, {
          name: param.name,
          in: param.in,
          description: param.description,
          occurrences: 1,
          coverage: 0,
        });
      }
    }
  }

  return [...counts.values()]
    .map((candidate) => ({
      ...candidate,
      coverage: candidate.occurrences / operations.length,
    }))
    .filter((candidate) => candidate.coverage >= minCoverage)
    .sort((a, b) => b.occurrences - a.occurrences);
}

export interface IngestOptions {
  /** Lower the credential detection threshold for small specs. */
  minCredentialCoverage?: number;
}

/**
 * Parses an OpenAPI 3.x or Swagger 2.0 document (JSON or YAML), resolves every
 * `$ref`, and flattens it into the operation records Argent stores.
 */
export async function ingestSpec(
  raw: string,
  options: IngestOptions = {},
): Promise<IngestResult> {
  const warnings: string[] = [];

  const { schema, errors } = await dereference(raw);

  if (errors?.length) {
    for (const error of errors.slice(0, 10)) {
      const message =
        typeof error === "string"
          ? error
          : ((error as { message?: string })?.message ?? String(error));
      warnings.push(message);
    }
  }

  const doc = schema as RawDocument | undefined;
  if (!doc || typeof doc !== "object") {
    throw new Error(
      "That file could not be read as an OpenAPI document. Check that it is " +
        "valid YAML or JSON and starts with an `openapi:` or `swagger:` line.",
    );
  }

  if (!doc.paths || Object.keys(doc.paths).length === 0) {
    throw new Error(
      "The document parsed, but it does not describe any endpoints " +
        "(no `paths` section was found).",
    );
  }

  const operations: NormalizedOperation[] = [];
  const tagSet = new Set<string>();
  const seenKeys = new Set<string>();
  let sortOrder = 0;

  for (const [path, pathItem] of Object.entries(doc.paths)) {
    if (!pathItem || typeof pathItem !== "object") continue;

    const sharedParams = (pathItem.parameters ?? [])
      .map(normalizeParameter)
      .filter((param): param is ParameterDescriptor => Boolean(param));

    for (const method of HTTP_METHODS) {
      const rawOperation = pathItem[method] as RawOperation | undefined;
      if (!rawOperation || typeof rawOperation !== "object") continue;

      const ownParams = (rawOperation.parameters ?? [])
        .map(normalizeParameter)
        .filter((param): param is ParameterDescriptor => Boolean(param));

      // Operation-level parameters override path-level ones of the same name.
      const byName = new Map<string, ParameterDescriptor>();
      for (const param of [...sharedParams, ...ownParams]) {
        byName.set(`${param.in}:${param.name}`, param);
      }
      const params = [...byName.values()];

      const body = pickMediaType(rawOperation.requestBody?.content);
      const success = pickSuccessResponse(rawOperation.responses);
      const successMedia = pickMediaType(success?.response.content);

      let operationKey =
        rawOperation.operationId?.trim() || buildOperationKey(method, path);
      if (seenKeys.has(operationKey)) {
        operationKey = `${operationKey}_${sortOrder}`;
        warnings.push(
          `Duplicate operation id near ${method.toUpperCase()} ${path}; renamed to ${operationKey}.`,
        );
      }
      seenKeys.add(operationKey);

      const tags =
        rawOperation.tags?.filter((tag) => typeof tag === "string") ?? [];
      tags.forEach((tag) => tagSet.add(tag));

      operations.push({
        operationKey,
        method: method.toUpperCase(),
        path,
        summary: rawOperation.summary ?? null,
        description: rawOperation.description ?? null,
        tags: tags.length > 0 ? tags : ["Uncategorized"],
        params,
        requestSchema: body?.media.schema ?? null,
        requestContentType: body?.contentType ?? null,
        responseSchema: successMedia?.media.schema ?? null,
        responseContentTypes: Object.keys(success?.response.content ?? {}),
        successStatus: success?.status ?? null,
        deprecated: Boolean(rawOperation.deprecated),
        sortOrder: sortOrder++,
      });
    }
  }

  if (operations.length === 0) {
    throw new Error(
      "No callable endpoints were found in that document. It may only contain " +
        "component definitions.",
    );
  }

  if (tagSet.size === 0) tagSet.add("Uncategorized");

  const servers = resolveServers(doc);
  if (servers.length === 0) {
    warnings.push(
      "The document does not declare any servers, so you will need to type the " +
        "base URL yourself.",
    );
  }

  return {
    title: doc.info?.title?.trim() || "Untitled API",
    version: doc.info?.version ?? null,
    description: doc.info?.description ?? null,
    openapiVersion: doc.openapi ?? doc.swagger ?? null,
    servers,
    operations,
    tags: [...tagSet].sort(),
    credentialCandidates: detectCredentialCandidates(
      operations,
      options.minCredentialCoverage,
    ),
    warnings: [...new Set(warnings)],
  };
}
