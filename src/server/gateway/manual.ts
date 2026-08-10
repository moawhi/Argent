import "server-only";

import { prisma } from "@/server/db";
import {
  decryptSecrets,
  redact,
  redactUrl,
  type SecretBag,
} from "@/server/crypto";
import { buildOperationKey } from "@/server/openapi/ingest";
import type { ConnectionHeader } from "@/lib/connections/headers";
import { humanizeKey } from "@/lib/utils";
import { inferSemanticType } from "@/lib/openapi/infer";
import type { ExecuteResponseBody, RequestPreview } from "@/lib/gateway/types";
import type { ManualRequest } from "@/lib/requests/types";
import type { ParameterDescriptor } from "@/lib/openapi/types";
import type { Prisma } from "@prisma/client";
import { normalizePayload, parsePayload } from "./parse";

const TIMEOUT_MS = 30_000;

interface InjectionRule {
  in: "query" | "header";
  name: string;
  secretKey: string;
}

/**
 * Replaces `{{name}}` placeholders. Connection variables win over secrets, so
 * a user can shadow a stored value while testing without touching the vault.
 */
function interpolate(
  text: string,
  variables: Record<string, string>,
  secrets: SecretBag,
): string {
  return text.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (whole, name: string) => {
    if (name in variables) return variables[name];
    if (name in secrets) return secrets[name];
    return whole;
  });
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
  return allowed.some((entry) => host === entry || host.endsWith(`.${entry}`));
}

/**
 * Sends a hand-built request. Unlike the operation gateway this trusts the URL
 * the user typed, but it still runs server-side so credentials and the
 * host allowlist are enforced the same way.
 */
export async function executeManualRequest(
  request: ManualRequest,
): Promise<ExecuteResponseBody> {
  let secrets: SecretBag = {};
  let variables: Record<string, string> = {};
  let injection: InjectionRule[] = [];
  let authKind = "none";
  let defaultHeaders: ConnectionHeader[] = [];
  let baseUrl = "";
  let connectionId: string | null = request.connectionId ?? null;

  if (connectionId) {
    const connection = await prisma.connection.findUnique({
      where: { id: connectionId },
      include: { authProfile: true },
    });

    if (!connection) {
      connectionId = null;
    } else {
      const method = request.method.toUpperCase();
      if (
        connection.readOnly &&
        method !== "GET" &&
        method !== "HEAD" &&
        method !== "OPTIONS"
      ) {
        return {
          ok: false,
          status: null,
          durationMs: 0,
          contentType: null,
          error: {
            kind: "readOnly",
            message: `“${connection.name}” is in read-only mode, so this ${method} was not sent.`,
            detail:
              "Open the connection's settings and turn on “Allow changes”, or " +
              "switch this request to “No connection” and type the full address.",
          },
        };
      }

      baseUrl = connection.baseUrl;
      variables = Object.fromEntries(
        Object.entries(
          (connection.variables as Record<string, unknown>) ?? {},
        ).map(([key, value]) => [key, String(value)]),
      );
      defaultHeaders =
        (connection.defaultHeaders as unknown as ConnectionHeader[]) ?? [];

      if (connection.authProfile && connection.authProfile.kind !== "none") {
        authKind = connection.authProfile.kind;
        try {
          secrets = decryptSecrets(connection.authProfile.encryptedSecrets);
        } catch (error) {
          return {
            ok: false,
            status: null,
            durationMs: 0,
            contentType: null,
            error: {
              kind: "noCredentials",
              message:
                error instanceof Error
                  ? error.message
                  : "Saved credentials could not be read.",
            },
          };
        }

        if (request.authMode === "inherit") {
          injection =
            (connection.authProfile.injection as unknown as InjectionRule[]) ??
            [];
        }
      }
    }
  }

  /* Build the URL ---------------------------------------------------- */

  const rawUrl = interpolate(request.url.trim(), variables, secrets);
  const absolute = /^https?:\/\//i.test(rawUrl)
    ? rawUrl
    : `${baseUrl.replace(/\/+$/, "")}/${rawUrl.replace(/^\/+/, "")}`;

  let url: URL;
  try {
    url = new URL(absolute);
  } catch {
    return {
      ok: false,
      status: null,
      durationMs: 0,
      contentType: null,
      error: {
        kind: "config",
        message: rawUrl
          ? `“${rawUrl}” is not a complete web address.`
          : "Enter a web address to send this request to.",
        detail: connectionId
          ? "Either type a full https:// address or a path starting with /."
          : "Pick a connection, or type the full https:// address.",
      },
    };
  }

  for (const entry of request.queryParams) {
    if (!entry.enabled || !entry.key.trim()) continue;
    url.searchParams.set(
      interpolate(entry.key, variables, secrets),
      interpolate(entry.value, variables, secrets),
    );
  }

  /* Headers and auth -------------------------------------------------- */

  const headers: Record<string, string> = { Accept: "application/json, */*" };

  // The connection's own headers first; anything typed into this request wins.
  for (const header of defaultHeaders) {
    if (!header?.key || header.enabled === false || header.secret) continue;
    headers[header.key] = interpolate(header.value ?? "", variables, secrets);
  }

  for (const entry of request.headers) {
    if (!entry.enabled || !entry.key.trim()) continue;
    headers[interpolate(entry.key, variables, secrets)] = interpolate(
      entry.value,
      variables,
      secrets,
    );
  }

  const auth = request.authConfig ?? {};
  switch (request.authMode) {
    case "bearer":
      if (auth.token) {
        headers.Authorization = `Bearer ${interpolate(auth.token, variables, secrets)}`;
      }
      break;
    case "basic":
      if (auth.username) {
        const encoded = Buffer.from(
          `${interpolate(auth.username, variables, secrets)}:${interpolate(auth.password ?? "", variables, secrets)}`,
        ).toString("base64");
        headers.Authorization = `Basic ${encoded}`;
      }
      break;
    case "apiKey":
      if (auth.keyName && auth.keyValue) {
        const value = interpolate(auth.keyValue, variables, secrets);
        if (auth.keyIn === "header") headers[auth.keyName] = value;
        else url.searchParams.set(auth.keyName, value);
      }
      break;
    case "inherit":
      for (const rule of injection) {
        const value = secrets[rule.secretKey];
        if (!value) continue;
        if (rule.in === "query") url.searchParams.set(rule.name, value);
        else headers[rule.name] = value;
      }
      // Match the operation gateway: connection-level bearer/basic win last.
      if (authKind === "bearer" && secrets.token) {
        headers.Authorization = `Bearer ${secrets.token}`;
      }
      if (authKind === "basic" && secrets.username) {
        const encoded = Buffer.from(
          `${secrets.username}:${secrets.password ?? ""}`,
        ).toString("base64");
        headers.Authorization = `Basic ${encoded}`;
      }
      break;
    case "none":
    default:
      break;
  }

  if (!hostAllowed(url)) {
    return {
      ok: false,
      status: null,
      durationMs: 0,
      contentType: null,
      error: {
        kind: "blockedHost",
        message: `Requests to ${url.hostname} are not allowed.`,
        detail:
          "Add the host to GATEWAY_ALLOWED_HOSTS to let seeIt call it.",
      },
    };
  }

  /* Body --------------------------------------------------------------- */

  const method = request.method.toUpperCase();
  const sendsBody = method !== "GET" && method !== "HEAD";
  let bodyText: string | undefined;

  if (sendsBody && request.bodyMode !== "none" && request.body.trim()) {
    bodyText = interpolate(request.body, variables, secrets);

    if (request.bodyMode === "json") {
      try {
        JSON.parse(bodyText);
      } catch (error) {
        return {
          ok: false,
          status: null,
          durationMs: 0,
          contentType: null,
          error: {
            kind: "invalidParam",
            message: "The request body is not valid JSON.",
            detail: error instanceof Error ? error.message : undefined,
          },
        };
      }
      headers["Content-Type"] ??= "application/json";
    } else if (request.bodyMode === "form") {
      headers["Content-Type"] ??= "application/x-www-form-urlencoded";
    } else {
      headers["Content-Type"] ??= "text/plain";
    }
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
    body: bodyText ? redact(bodyText, secrets) : undefined,
  };

  /* Send ---------------------------------------------------------------- */

  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: bodyText,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
      redirect: "follow",
    });

    const contentType = response.headers.get("content-type");
    const text = await response.text();
    const durationMs = Date.now() - startedAt;
    const ok = response.status < 400;

    if (connectionId) {
      await prisma.requestLog
        .create({
          data: {
            connectionId,
            method,
            url: redactUrl(url, secrets),
            status: response.status,
            ok,
            durationMs,
            error: ok ? null : `HTTP ${response.status}`,
            requestBytes: bodyText ? Buffer.byteLength(bodyText) : null,
            responseBytes: Buffer.byteLength(text),
            origin: "manual",
          },
        })
        .catch(() => {});
    }

    const { data } = parsePayload(text, contentType);
    const normalized = normalizePayload(data, null);

    return {
      ok,
      status: response.status,
      durationMs,
      contentType,
      data: normalized.data,
      rows: normalized.rows ?? undefined,
      envelope: normalized.envelope ?? undefined,
      fields: normalized.fields,
      responseKind: normalized.kind,
      rowCount: normalized.rows?.length,
      requestPreview: preview,
      error: ok
        ? undefined
        : {
            kind: "upstreamError",
            message: `The API answered with HTTP ${response.status}.`,
            detail: text.slice(0, 500),
          },
    };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const isTimeout =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError");

    return {
      ok: false,
      status: null,
      durationMs,
      contentType: null,
      requestPreview: preview,
      error: isTimeout
        ? {
            kind: "timeout",
            message: `${url.hostname} did not respond within 30 seconds.`,
          }
        : {
            kind: "network",
            message: `seeIt could not reach ${url.hostname}.`,
            detail: error instanceof Error ? error.message : String(error),
          },
    };
  }
}

/**
 * Turns a saved manual request into a real Operation, so it can back objects
 * exactly like an imported endpoint. Query parameters become operation
 * parameters, and the last response shape becomes the response schema.
 */
export async function saveRequestAsOperation(input: {
  connectionId: string;
  request: ManualRequest;
  sampleResponse?: unknown;
  tag?: string;
}) {
  const { connectionId, request } = input;

  const connection = await prisma.connection.findUnique({
    where: { id: connectionId },
    select: { baseUrl: true },
  });
  if (!connection) throw new Error("That connection no longer exists.");

  // Store the path relative to the connection's base URL so the gateway can
  // resolve it the same way it resolves imported operations.
  let path = request.url.trim();
  if (/^https?:\/\//i.test(path)) {
    try {
      const parsed = new URL(path);
      const base = new URL(connection.baseUrl);
      path = parsed.pathname.startsWith(base.pathname)
        ? parsed.pathname.slice(base.pathname.replace(/\/$/, "").length)
        : parsed.pathname;
    } catch {
      // Leave it as typed; the gateway will report a clear error.
    }
  }
  if (!path.startsWith("/")) path = `/${path}`;

  const params: ParameterDescriptor[] = request.queryParams
    .filter((entry) => entry.enabled && entry.key.trim())
    .map((entry) => ({
      name: entry.key,
      in: "query" as const,
      required: false,
      description: entry.description,
      type: "string" as const,
      semantic: inferSemanticType(entry.key, { type: "string" }),
      default: entry.value || undefined,
    }));

  // Path placeholders written as {id} become required path parameters.
  for (const match of path.matchAll(/\{([^}]+)\}/g)) {
    params.push({
      name: match[1],
      in: "path",
      required: true,
      type: "string",
      semantic: inferSemanticType(match[1], { type: "string" }),
    });
  }

  const staticHeaders = request.headers
    .filter((entry) => entry.enabled && entry.key.trim())
    .map((entry) => ({ key: entry.key, value: entry.value, enabled: true }));

  const responseSchema = input.sampleResponse
    ? schemaFromSample(input.sampleResponse)
    : null;

  const operationKey = `${buildOperationKey(request.method, path)}_manual`;

  const data = {
    connectionId,
    operationKey,
    method: request.method.toUpperCase(),
    path,
    summary: request.name.trim() || `${request.method} ${path}`,
    description: "Added by hand in the request builder.",
    tags: [input.tag ?? "Added by hand"],
    params: params as unknown as Prisma.InputJsonValue,
    requestSchema:
      request.bodyMode === "json" && request.body.trim()
        ? (schemaFromSample(safeParse(request.body)) as Prisma.InputJsonValue)
        : undefined,
    requestContentType: request.bodyMode === "json" ? "application/json" : null,
    responseSchema: (responseSchema as Prisma.InputJsonValue) ?? undefined,
    responseContentTypes: ["application/json"],
    successStatus: "200",
    staticHeaders: staticHeaders as unknown as Prisma.InputJsonValue,
    source: "manual",
  };

  return prisma.operation.upsert({
    where: { connectionId_operationKey: { connectionId, operationKey } },
    create: data,
    update: data,
  });
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Derives a minimal JSON Schema from a real response, for object building. */
function schemaFromSample(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined || depth > 4) return {};

  if (Array.isArray(value)) {
    return { type: "array", items: schemaFromSample(value[0], depth + 1) };
  }

  switch (typeof value) {
    case "string":
      return {
        type: "string",
        ...(/^\d{4}-\d{2}-\d{2}T/.test(value)
          ? { format: "date-time" }
          : /^\d{4}-\d{2}-\d{2}$/.test(value)
            ? { format: "date" }
            : {}),
      };
    case "number":
      return { type: Number.isInteger(value) ? "integer" : "number" };
    case "boolean":
      return { type: "boolean" };
    case "object": {
      const properties: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(
        value as Record<string, unknown>,
      )) {
        properties[key] = {
          ...(schemaFromSample(child, depth + 1) as object),
          title: humanizeKey(key),
        };
      }
      return { type: "object", properties };
    }
    default:
      return {};
  }
}
