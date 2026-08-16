import "server-only";

import { prisma } from "@/server/db";
import {
  decryptSecrets,
  redact,
  redactUrl,
  type SecretBag,
} from "@/server/crypto";
import { analyzeResponse } from "@/lib/openapi/infer";
import type { ConnectionHeader } from "@/lib/connections/headers";
import { getByPath } from "@/lib/utils";
import type {
  JsonSchema,
  ParameterDescriptor,
} from "@/lib/openapi/types";
import {
  FETCH_LIMITS,
  applyPaginationToParams,
  findLimitParamName,
  normalizePagination,
} from "@/lib/gateway/pagination";
import type {
  ExecutePagination,
  ExecuteResponseBody,
  GatewayError,
  ParamBinding,
  ParamBindings,
  RequestOrigin,
  RequestPreview,
} from "@/lib/gateway/types";
import { truncateForLog } from "@/server/auth/api-grants";
import { cacheGet, cacheSet } from "./cache";
import { normalizePayload, parsePayload } from "./parse";
import { applyRowCap } from "./row-limits";

const DEFAULT_TIMEOUT_MS = 30_000;
const CACHE_TTL_MS = 15_000;
const MAX_RESPONSE_BYTES = 12 * 1024 * 1024;

/** Where a secret gets attached to an outgoing request. */
interface InjectionRule {
  in: "query" | "header";
  name: string;
  secretKey: string;
}

export interface ExecuteInput {
  objectId?: string;
  operationId?: string;
  params?: Record<string, unknown>;
  body?: unknown;
  filters?: Record<string, unknown>;
  pagination?: ExecutePagination;
  origin?: RequestOrigin;
  confirmWrite?: boolean;
  noCache?: boolean;
  /** Signed-in caller, stored on RequestLog for the Activity tab. */
  userId?: string;
}

function fail(error: GatewayError, durationMs = 0): ExecuteResponseBody {
  return {
    ok: false,
    status: null,
    durationMs,
    contentType: null,
    error,
  };
}

/* ------------------------------------------------------------------ *
 * Parameter binding
 * ------------------------------------------------------------------ */

function coerceParamValue(
  raw: unknown,
  param: ParameterDescriptor,
): { value?: string; error?: string } {
  if (raw === null || raw === undefined || raw === "") return {};

  if (Array.isArray(raw)) {
    return { value: raw.map((item) => String(item)).join(",") };
  }

  if (typeof raw === "boolean") return { value: raw ? "true" : "false" };

  if (param.type === "integer" || param.type === "number") {
    const num = typeof raw === "number" ? raw : Number(String(raw).trim());
    if (!Number.isFinite(num)) {
      return { error: `“${String(raw)}” is not a number.` };
    }
    if (param.type === "integer" && !Number.isInteger(num)) {
      return { error: `“${String(raw)}” must be a whole number.` };
    }
    if (param.minimum !== undefined && num < param.minimum) {
      return { error: `Must be ${param.minimum} or more.` };
    }
    if (param.maximum !== undefined && num > param.maximum) {
      return { error: `Must be ${param.maximum} or less.` };
    }
    return { value: String(num) };
  }

  const text = String(raw);

  if (param.enumValues?.length && !param.enumValues.includes(text)) {
    return {
      error: `Must be one of: ${param.enumValues.join(", ")}.`,
    };
  }

  return { value: text };
}

/**
 * Works out the value for a single parameter, in priority order:
 * an explicit value, then the object's saved binding, then the spec default.
 */
function resolveParamValue(
  param: ParameterDescriptor,
  explicit: Record<string, unknown>,
  bindings: ParamBindings,
  filters: Record<string, unknown>,
): unknown {
  if (Object.prototype.hasOwnProperty.call(explicit, param.name)) {
    return explicit[param.name];
  }

  const binding: ParamBinding | undefined = bindings[param.name];
  if (binding) {
    switch (binding.mode) {
      case "static":
        return binding.value;
      case "filter":
        return getByPath(filters, binding.filterKey);
      case "selection":
        return getByPath(filters, binding.field);
      case "omit":
        return undefined;
      case "credential":
      case "prompt":
        // Credentials are injected separately; prompts arrive as explicit values.
        return undefined;
    }
  }

  return param.default;
}

/** Keep injected page size within the OpenAPI maximum for the limit param. */
function clampPaginationToParamMaximum(
  pagination: { limit: number; offset: number },
  params: ParameterDescriptor[],
): { limit: number; offset: number } {
  const limitName = findLimitParamName(params.map((param) => param.name));
  if (!limitName) return pagination;

  const descriptor = params.find((param) => param.name === limitName);
  if (descriptor?.maximum === undefined) return pagination;

  return {
    ...pagination,
    limit: Math.min(pagination.limit, descriptor.maximum),
  };
}

/* ------------------------------------------------------------------ *
 * URL building
 * ------------------------------------------------------------------ */

function joinUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}

function hostAllowed(url: URL): boolean {
  const raw = process.env.GATEWAY_ALLOWED_HOSTS?.trim();
  if (!raw) return true;

  const allowed = raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  if (allowed.length === 0) return true;

  const host = url.hostname.toLowerCase();
  return allowed.some(
    (entry) => host === entry || host.endsWith(`.${entry}`),
  );
}

/* ------------------------------------------------------------------ *
 * Execution
 * ------------------------------------------------------------------ */

export async function executeOperation(
  input: ExecuteInput,
): Promise<ExecuteResponseBody> {
  const origin = input.origin ?? "gateway";
  const filters = input.filters ?? {};
  const pagination = input.pagination
    ? normalizePagination(input.pagination, FETCH_LIMITS.hardMax)
    : { limit: FETCH_LIMITS.hardMax, offset: 0 };

  /* 1. Resolve the object and operation ------------------------------ */

  let bindings: ParamBindings = {};
  let operationId = input.operationId ?? null;

  if (input.objectId) {
    const object = await prisma.dataObject.findUnique({
      where: { id: input.objectId },
      select: { operationId: true, paramBindings: true },
    });
    if (!object?.operationId) {
      return fail({
        kind: "notFound",
        message: "That object is not connected to an endpoint any more.",
        detail:
          "The endpoint it used was removed, probably when its spec was re-imported.",
      });
    }
    operationId = object.operationId;
    bindings = (object.paramBindings as ParamBindings) ?? {};
  }

  if (!operationId) {
    return fail({
      kind: "notFound",
      message: "No endpoint was specified for this request.",
    });
  }

  const operation = await prisma.operation.findUnique({
    where: { id: operationId },
    include: { connection: { include: { authProfile: true } } },
  });

  if (!operation) {
    return fail({
      kind: "notFound",
      message: "That endpoint no longer exists.",
    });
  }

  const { connection } = operation;

  /* 1b. Database connections run SQL instead of HTTP ------------------ */

  if (connection.type === "database" || operation.source === "sql") {
    const sqlParams: Record<string, unknown> = { ...(input.params ?? {}) };
    const opParams =
      (operation.params as unknown as ParameterDescriptor[]) ?? [];
    for (const param of opParams) {
      if (sqlParams[param.name] !== undefined) continue;
      const raw = resolveParamValue(
        param,
        input.params ?? {},
        bindings,
        filters,
      );
      const { value } = coerceParamValue(raw, param);
      if (value !== undefined) sqlParams[param.name] = value;
    }

    const { executeSqlOperation } = await import("@/server/database/executor");
    return executeSqlOperation({
      operationId: operation.id,
      connectionId: connection.id,
      params: sqlParams,
      filters,
      pagination: input.pagination ?? pagination,
      origin,
      confirmWrite: input.confirmWrite,
      noCache: input.noCache,
      userId: input.userId,
    });
  }

  const method = operation.method.toUpperCase();
  const isWrite = method !== "GET" && method !== "HEAD";

  /* 2. Safety guards -------------------------------------------------- */

  if (isWrite && connection.readOnly) {
    return fail({
      kind: "readOnly",
      message: `“${connection.name}” is in read-only mode, so nothing can be changed through it.`,
      detail:
        "Open the connection's settings and turn on “Allow changes” to enable " +
        `${method} requests.`,
    });
  }

  if (isWrite && !input.confirmWrite) {
    return fail({
      kind: "readOnly",
      message: "This request changes data, so it needs to be confirmed first.",
      detail: `${method} ${operation.path} was not sent.`,
    });
  }

  /* 3. Credentials ---------------------------------------------------- */

  const authProfile = connection.authProfile;
  let secrets: SecretBag = {};

  if (authProfile && authProfile.kind !== "none") {
    try {
      secrets = decryptSecrets(authProfile.encryptedSecrets);
    } catch (error) {
      return fail({
        kind: "noCredentials",
        message:
          error instanceof Error
            ? error.message
            : "Saved credentials could not be read.",
      });
    }

    const missing = authProfile.secretKeys.filter((key) => !secrets[key]);
    if (missing.length > 0) {
      return fail({
        kind: "noCredentials",
        message: `“${connection.name}” is missing its ${missing.join(" and ")}.`,
        detail: "Add the missing values in the connection's settings.",
      });
    }
  }

  /* 4. Build the request ---------------------------------------------- */

  const params = (operation.params as unknown as ParameterDescriptor[]) ?? [];
  const credentialNames = new Set(
    ((authProfile?.injection as unknown as InjectionRule[]) ?? []).map(
      (rule) => `${rule.in}:${rule.name}`,
    ),
  );

  let path = operation.path;
  const query = new URLSearchParams();
  const headers: Record<string, string> = { Accept: "application/json, */*" };
  const missingParams: string[] = [];

  // Connection-wide headers go on first, so anything more specific wins.
  for (const header of (connection.defaultHeaders as unknown as ConnectionHeader[]) ??
    []) {
    if (!header?.key || header.enabled === false || header.secret) continue;
    headers[header.key] = header.value ?? "";
  }

  // Chart/table fetch caps (e.g. 2000) must not exceed the API's declared max.
  const schemaSafePagination = clampPaginationToParamMaximum(pagination, params);

  const explicit = applyPaginationToParams(
    input.params ?? {},
    schemaSafePagination,
    params.map((param) => param.name),
    { overwrite: Boolean(input.pagination) },
  );

  for (const param of params) {
    // Credentials are injected below, never taken from the client.
    if (credentialNames.has(`${param.in}:${param.name}`)) continue;

    const raw = resolveParamValue(param, explicit, bindings, filters);
    const { value, error } = coerceParamValue(raw, param);

    if (error) {
      return fail({
        kind: "invalidParam",
        message: `${param.name}: ${error}`,
        param: param.name,
      });
    }

    if (value === undefined) {
      if (param.required) missingParams.push(param.name);
      continue;
    }

    switch (param.in) {
      case "path":
        path = path.replace(
          `{${param.name}}`,
          encodeURIComponent(value),
        );
        break;
      case "query":
        query.set(param.name, value);
        break;
      case "header":
        headers[param.name] = value;
        break;
      case "cookie":
        headers.Cookie = headers.Cookie
          ? `${headers.Cookie}; ${param.name}=${value}`
          : `${param.name}=${value}`;
        break;
    }
  }

  if (missingParams.length > 0) {
    const list = missingParams.join(", ");
    return fail({
      kind: "missingParam",
      message:
        missingParams.length === 1
          ? `“${list}” is required but was not provided.`
          : `These required values are missing: ${list}.`,
      param: missingParams[0],
    });
  }

  // Any path placeholder still present means a required value slipped through.
  const unresolved = path.match(/\{([^}]+)\}/);
  if (unresolved) {
    return fail({
      kind: "missingParam",
      message: `“${unresolved[1]}” is part of the address and must be filled in.`,
      param: unresolved[1],
    });
  }

  // Static headers, mostly used by manually created operations.
  for (const header of (operation.staticHeaders as unknown as {
    key: string;
    value: string;
    enabled?: boolean;
  }[]) ?? []) {
    if (header?.key && header.enabled !== false) {
      headers[header.key] = header.value ?? "";
    }
  }

  // Credential injection happens last so nothing can overwrite it.
  for (const rule of (authProfile?.injection as unknown as InjectionRule[]) ??
    []) {
    const value = secrets[rule.secretKey];
    if (!value) continue;
    if (rule.in === "query") query.set(rule.name, value);
    else headers[rule.name] = value;
  }

  if (authProfile?.kind === "bearer" && secrets.token) {
    headers.Authorization = `Bearer ${secrets.token}`;
  }
  if (authProfile?.kind === "basic" && secrets.username) {
    const encoded = Buffer.from(
      `${secrets.username}:${secrets.password ?? ""}`,
    ).toString("base64");
    headers.Authorization = `Basic ${encoded}`;
  }

  let url: URL;
  try {
    url = new URL(joinUrl(connection.baseUrl, path));
  } catch {
    return fail({
      kind: "config",
      message: `“${connection.baseUrl}” is not a valid web address.`,
      detail: "Fix the base URL in the connection's settings.",
    });
  }

  for (const [key, value] of query) url.searchParams.set(key, value);

  if (!hostAllowed(url)) {
    return fail({
      kind: "blockedHost",
      message: `Requests to ${url.hostname} are not allowed.`,
      detail:
        "Add the host to GATEWAY_ALLOWED_HOSTS if this connection should be reachable.",
    });
  }

  let bodyText: string | undefined;
  if (isWrite && input.body !== undefined && input.body !== null) {
    bodyText =
      typeof input.body === "string"
        ? input.body
        : JSON.stringify(input.body);
    headers["Content-Type"] =
      operation.requestContentType ?? "application/json";
  }

  const preview: RequestPreview = {
    method,
    url: redactUrl(url, secrets),
    headers: Object.fromEntries(
      Object.entries(headers).map(([key, value]) => [
        key,
        redact(value, secrets),
      ]),
    ),
    body: bodyText,
  };

  /* 5. Cache ---------------------------------------------------------- */

  const cacheKey = `${connection.id}:${method}:${url.toString()}`;
  if (!isWrite && !input.noCache) {
    const cached = cacheGet<ExecuteResponseBody>(cacheKey);
    if (cached) {
      return { ...cached, cached: true, requestPreview: preview };
    }
  }

  /* 6. Call upstream --------------------------------------------------- */

  const startedAt = Date.now();
  let status: number | null = null;
  let contentType: string | null = null;
  let responseText = "";
  let networkError: GatewayError | null = null;

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: bodyText,
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      cache: "no-store",
      redirect: "follow",
    });

    status = response.status;
    contentType = response.headers.get("content-type");

    const declaredLength = Number(response.headers.get("content-length") ?? 0);
    if (declaredLength > MAX_RESPONSE_BYTES) {
      networkError = {
        kind: "upstreamError",
        message: "That endpoint returned more data than Argent can display.",
        detail: `${Math.round(declaredLength / 1024 / 1024)} MB exceeds the 12 MB limit. Add a date range or limit parameter.`,
      };
    } else if (contentType?.includes("pdf") || contentType?.includes("octet-stream")) {
      responseText = "";
      contentType = contentType ?? "application/octet-stream";
    } else {
      responseText = await response.text();
      if (responseText.length > MAX_RESPONSE_BYTES) {
        networkError = {
          kind: "upstreamError",
          message: "That endpoint returned more data than Argent can display.",
          detail: "Add a date range or a limit parameter to narrow the result.",
        };
      }
    }
  } catch (error) {
    const isTimeout =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError");

    networkError = isTimeout
      ? {
          kind: "timeout",
          message: `${url.hostname} did not respond within 30 seconds.`,
          detail: "The endpoint may be slow, or the date range may be too wide.",
        }
      : {
          kind: "network",
          message: `Argent could not reach ${url.hostname}.`,
          detail: error instanceof Error ? error.message : String(error),
        };
  }

  const durationMs = Date.now() - startedAt;

  /* 7. Log ------------------------------------------------------------- */

  const ok = networkError === null && status !== null && status < 400;

  const redactedBody = bodyText ? redact(bodyText, secrets) : null;
  const redactedResponse = responseText
    ? redact(responseText, secrets)
    : null;

  await prisma.requestLog
    .create({
      data: {
        connectionId: connection.id,
        operationId: operation.id,
        userId: input.userId,
        method,
        url: redactUrl(url, secrets),
        status,
        ok,
        durationMs,
        error: networkError?.message ?? (ok ? null : `HTTP ${status}`),
        requestBytes: bodyText ? Buffer.byteLength(bodyText) : null,
        responseBytes: responseText ? Buffer.byteLength(responseText) : null,
        requestParams: truncateForLog(explicit) ?? undefined,
        requestBody: truncateForLog(redactedBody) ?? undefined,
        responseBody: truncateForLog(
          redactedResponse
            ? (() => {
                try {
                  return JSON.parse(redactedResponse) as unknown;
                } catch {
                  return redactedResponse;
                }
              })()
            : null,
        ) ?? undefined,
        origin,
      },
    })
    .catch(() => {
      // Logging must never break a working request.
    });

  await prisma.connection
    .update({
      where: { id: connection.id },
      data: {
        status: ok ? "healthy" : "failing",
        lastCheckedAt: new Date(),
        lastError: ok ? null : (networkError?.message ?? `HTTP ${status}`),
      },
    })
    .catch(() => {});

  if (networkError) {
    return { ...fail(networkError, durationMs), requestPreview: preview };
  }

  /* 8. Interpret the response ------------------------------------------ */

  const { data } = parsePayload(responseText, contentType);

  if (!ok) {
    return {
      ok: false,
      status,
      durationMs,
      contentType,
      data,
      requestPreview: preview,
      error: {
        kind: "upstreamError",
        message: describeHttpStatus(status, connection.name),
        detail: extractUpstreamMessage(data) ?? responseText.slice(0, 400),
      },
    };
  }

  const schemaShape = analyzeResponse(
    operation.responseSchema as JsonSchema | null,
  );
  const normalized = normalizePayload(data, schemaShape.rowsPath);

  // Schema descriptors carry richer hints (currency, enums, descriptions), so
  // prefer them and fall back to value-derived ones for undocumented fields.
  const schemaFields = schemaShape.fields;
  const fields =
    schemaFields.length > 0
      ? mergeFields(schemaFields, normalized.fields)
      : normalized.fields;

  const result = applyRowCap(
    {
      ok: true,
      status,
      durationMs,
      contentType,
      data: normalized.data,
      rows: normalized.rows ?? undefined,
      envelope: normalized.envelope ?? undefined,
      fields,
      responseKind: normalized.kind,
      rowCount: normalized.rows?.length ?? undefined,
      cached: false,
    },
    pagination,
  );

  if (!isWrite) cacheSet(cacheKey, result, CACHE_TTL_MS);

  return { ...result, requestPreview: preview };
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function mergeFields(
  fromSchema: ExecuteResponseBody["fields"],
  fromValues: ExecuteResponseBody["fields"],
) {
  if (!fromSchema) return fromValues;
  if (!fromValues) return fromSchema;

  const known = new Set(fromSchema.map((field) => field.path));
  const extras = fromValues.filter((field) => !known.has(field.path));
  return [...fromSchema, ...extras];
}

function describeHttpStatus(
  status: number | null,
  connectionName: string,
): string {
  switch (status) {
    case 400:
      return "The API rejected this request as invalid.";
    case 401:
      return `${connectionName} did not accept the saved credentials.`;
    case 403:
      return "Those credentials are not allowed to do this.";
    case 404:
      return "The API could not find what was asked for.";
    case 408:
      return "The API timed out handling this request.";
    case 429:
      return "Too many requests were sent; the API asked us to slow down.";
    case 500:
    case 502:
    case 503:
    case 504:
      return `${connectionName} had a server error handling this request.`;
    default:
      return `The API returned an unexpected response (HTTP ${status}).`;
  }
}

/** Pulls a human message out of a typical `{ error: "..." }` body. */
function extractUpstreamMessage(data: unknown): string | null {
  if (typeof data === "string") return data.slice(0, 400) || null;
  if (!data || typeof data !== "object") return null;

  const record = data as Record<string, unknown>;
  for (const key of ["message", "error", "detail", "title", "description"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
    if (value && typeof value === "object") {
      const nested = (value as Record<string, unknown>).message;
      if (typeof nested === "string" && nested.trim()) return nested;
    }
  }
  return null;
}
