import "server-only";

import { createHash } from "node:crypto";
import { prisma } from "@/server/db";
import { encryptSecrets, decryptSecrets } from "@/server/crypto";
import { cacheInvalidateConnection } from "@/server/gateway/cache";
import { executeOperation } from "@/server/gateway/executor";
import { ingestSpec } from "@/server/openapi/ingest";
import {
  headerSecretKey,
  isHeaderSecretKey,
  validateHeader,
  type ConnectionHeader,
} from "@/lib/connections/headers";
import { slugify } from "@/lib/utils";
import type {
  CredentialCandidate,
  IngestResult,
  ParameterDescriptor,
} from "@/lib/openapi/types";
import type { Prisma } from "@prisma/client";

export interface InjectionRule {
  in: "query" | "header";
  name: string;
  secretKey: string;
}

/* ------------------------------------------------------------------ *
 * Import
 * ------------------------------------------------------------------ */

export async function previewSpec(raw: string): Promise<IngestResult> {
  return ingestSpec(raw);
}

/** Downloads a spec from a URL, with clearer errors than a bare fetch. */
export async function fetchSpecFromUrl(url: string): Promise<string> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(
      `“${url}” is not a valid web address. It should start with https://`,
    );
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http and https addresses can be imported.");
  }

  let response: Response;
  try {
    response = await fetch(parsed, {
      headers: { Accept: "application/json, application/yaml, text/yaml, */*" },
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
  } catch (error) {
    throw new Error(
      `Could not reach ${parsed.hostname}. ` +
        (error instanceof Error ? error.message : ""),
    );
  }

  if (!response.ok) {
    throw new Error(
      `${parsed.hostname} responded with HTTP ${response.status} instead of a spec.`,
    );
  }

  return response.text();
}

async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base) || "api";
  let candidate = root;
  let suffix = 2;

  while (await prisma.connection.findUnique({ where: { slug: candidate } })) {
    candidate = `${root}-${suffix++}`;
  }

  return candidate;
}

export interface CreateConnectionInput {
  name: string;
  rawSpec: string;
  specFormat?: string;
  baseUrl: string;
  /** Which detected credential parameters to promote, with their values. */
  credentials?: { name: string; in: "query" | "header"; value: string }[];
  readOnly?: boolean;
}

export async function createConnectionFromSpec(input: CreateConnectionInput) {
  const ingest = await ingestSpec(input.rawSpec);

  const name = input.name.trim() || ingest.title;
  const slug = await uniqueSlug(name);

  const specHash = createHash("sha256")
    .update(input.rawSpec)
    .digest("hex")
    .slice(0, 32);

  const connection = await prisma.connection.create({
    data: {
      name,
      slug,
      description: ingest.description,
      baseUrl: input.baseUrl.replace(/\/+$/, ""),
      servers: ingest.servers as unknown as Prisma.InputJsonValue,
      specFormat: input.specFormat ?? "yaml",
      rawSpec: input.rawSpec,
      specHash,
      specTitle: ingest.title,
      specVersion: ingest.version,
      openapiVersion: ingest.openapiVersion,
      readOnly: input.readOnly ?? true,
      operations: {
        create: ingest.operations.map((operation) => ({
          operationKey: operation.operationKey,
          method: operation.method,
          path: operation.path,
          summary: operation.summary,
          description: operation.description,
          tags: operation.tags,
          params: operation.params as unknown as Prisma.InputJsonValue,
          requestSchema:
            (operation.requestSchema as Prisma.InputJsonValue) ?? undefined,
          requestContentType: operation.requestContentType,
          responseSchema:
            (operation.responseSchema as Prisma.InputJsonValue) ?? undefined,
          responseContentTypes: operation.responseContentTypes,
          successStatus: operation.successStatus,
          deprecated: operation.deprecated,
          sortOrder: operation.sortOrder,
          source: "spec",
        })),
      },
    },
  });

  if (input.credentials?.length) {
    await saveCredentials(connection.id, input.credentials);
  }

  return { connection, ingest };
}

/* ------------------------------------------------------------------ *
 * Credentials
 * ------------------------------------------------------------------ */

/**
 * Stores credential values encrypted and records where each one is attached.
 * Existing values are preserved when a field is submitted blank, so the UI can
 * show a masked placeholder instead of forcing a re-entry.
 */
export async function saveCredentials(
  connectionId: string,
  credentials: { name: string; in: "query" | "header"; value: string }[],
) {
  const existing = await prisma.authProfile.findUnique({
    where: { connectionId },
  });

  const current = existing ? decryptSecrets(existing.encryptedSecrets) : {};
  const secrets: Record<string, string> = { ...current };

  // Custom headers are managed separately; leave their rules and values alone.
  const headerRules = (
    (existing?.injection as unknown as InjectionRule[]) ?? []
  ).filter((rule) => isHeaderSecretKey(rule.secretKey));

  const injection: InjectionRule[] = [];

  for (const credential of credentials) {
    const key = credential.name;
    if (credential.value.trim()) secrets[key] = credential.value.trim();
    injection.push({ in: credential.in, name: credential.name, secretKey: key });
  }

  // Drop secrets whose parameter is no longer configured, and clear token auth
  // when the connection switches to query/header parameter injection.
  delete secrets.token;
  delete secrets.username;
  delete secrets.password;

  const keep = new Set([
    ...injection.map((rule) => rule.secretKey),
    ...headerRules.map((rule) => rule.secretKey),
  ]);
  for (const key of Object.keys(secrets)) {
    if (!keep.has(key) && !isHeaderSecretKey(key)) delete secrets[key];
  }

  await writeAuthProfile(connectionId, [...injection, ...headerRules], secrets, {
    preserveTokenKind: false,
  });
}

/**
 * Writes the injection rules and secret bag back.
 * Header saves can keep an existing bearer/basic kind; credential saves
 * always derive kind from the injection rules.
 */
async function writeAuthProfile(
  connectionId: string,
  injection: InjectionRule[],
  secrets: Record<string, string>,
  options: { preserveTokenKind?: boolean } = {},
) {
  const existing = await prisma.authProfile.findUnique({
    where: { connectionId },
    select: { kind: true },
  });

  const derived =
    injection.length === 0
      ? "none"
      : injection.every((rule) => rule.in === "query")
        ? "queryParam"
        : "header";

  const kind =
    options.preserveTokenKind &&
    existing &&
    (existing.kind === "bearer" || existing.kind === "basic")
      ? existing.kind
      : derived;

  const secretKeys = Object.keys(secrets);
  const data = {
    kind,
    injection: injection as unknown as Prisma.InputJsonValue,
    encryptedSecrets: secretKeys.length > 0 ? encryptSecrets(secrets) : null,
    secretKeys,
  };

  await prisma.authProfile.upsert({
    where: { connectionId },
    create: { connectionId, ...data },
    update: data,
  });

  cacheInvalidateConnection(connectionId);
}

/* ------------------------------------------------------------------ *
 * Custom headers
 * ------------------------------------------------------------------ */

/**
 * The headers a connection adds to every outgoing request, safe to render:
 * secret values are replaced with a flag saying one is stored.
 */
export async function connectionHeaders(
  connectionId: string,
): Promise<(ConnectionHeader & { hasValue: boolean })[]> {
  const connection = await prisma.connection.findUnique({
    where: { id: connectionId },
    select: {
      defaultHeaders: true,
      authProfile: { select: { secretKeys: true } },
    },
  });

  if (!connection) return [];

  const stored = new Set(connection.authProfile?.secretKeys ?? []);

  return (
    (connection.defaultHeaders as unknown as ConnectionHeader[]) ?? []
  ).map((header) => ({
    ...header,
    value: header.secret ? "" : header.value,
    hasValue: header.secret ? stored.has(headerSecretKey(header.key)) : true,
  }));
}

/**
 * Replaces the connection's custom headers. Secret values go into the vault
 * under a `header:` key; a blank secret keeps whatever is already stored, so
 * the UI can show a masked placeholder rather than forcing a re-entry.
 */
export async function saveConnectionHeaders(
  connectionId: string,
  headers: ConnectionHeader[],
) {
  const named = headers.filter((header) => header.key.trim());

  for (const header of named) {
    const problem = validateHeader(header);
    if (problem) throw new Error(problem);
  }

  const seen = new Set<string>();
  for (const header of named) {
    const lower = header.key.trim().toLowerCase();
    if (seen.has(lower)) {
      throw new Error(
        `“${header.key.trim()}” is listed twice. Each header can only be set once.`,
      );
    }
    seen.add(lower);
  }

  const existing = await prisma.authProfile.findUnique({
    where: { connectionId },
  });

  const secrets = existing ? decryptSecrets(existing.encryptedSecrets) : {};
  const otherRules = (
    (existing?.injection as unknown as InjectionRule[]) ?? []
  ).filter((rule) => !isHeaderSecretKey(rule.secretKey));

  const headerRules: InjectionRule[] = [];
  const stored: ConnectionHeader[] = [];
  const keep = new Set<string>();

  for (const header of named) {
    const name = header.key.trim();

    if (!header.secret) {
      stored.push({
        key: name,
        value: header.value,
        enabled: header.enabled,
        secret: false,
        ...(header.description ? { description: header.description } : {}),
      });
      continue;
    }

    const secretKey = headerSecretKey(name);
    if (header.value.trim()) secrets[secretKey] = header.value.trim();
    keep.add(secretKey);

    // Only inject once there is something to send.
    if (header.enabled && secrets[secretKey]) {
      headerRules.push({ in: "header", name, secretKey });
    }

    stored.push({
      key: name,
      value: "",
      enabled: header.enabled,
      secret: true,
      ...(header.description ? { description: header.description } : {}),
    });
  }

  // Forget vault entries for headers that were removed or made public.
  for (const key of Object.keys(secrets)) {
    if (isHeaderSecretKey(key) && !keep.has(key)) delete secrets[key];
  }

  await prisma.connection.update({
    where: { id: connectionId },
    data: { defaultHeaders: stored as unknown as Prisma.InputJsonValue },
  });

  await writeAuthProfile(
    connectionId,
    [...otherRules, ...headerRules],
    secrets,
    { preserveTokenKind: true },
  );
}

/** Stores a bearer token or basic auth pair (or clears token auth). */
export async function saveTokenAuth(
  connectionId: string,
  kind: "bearer" | "basic" | "none",
  values: { token?: string; username?: string; password?: string },
) {
  const existing = await prisma.authProfile.findUnique({
    where: { connectionId },
  });

  const current = existing ? decryptSecrets(existing.encryptedSecrets) : {};

  // Custom headers are independent of how the connection authenticates.
  const headerRules = (
    (existing?.injection as unknown as InjectionRule[]) ?? []
  ).filter((rule) => isHeaderSecretKey(rule.secretKey));

  const secrets: Record<string, string> = Object.fromEntries(
    Object.entries(current).filter(([key]) => isHeaderSecretKey(key)),
  );

  if (kind === "bearer") {
    const next = values.token?.trim() || current.token;
    if (next) secrets.token = next;
  }
  if (kind === "basic") {
    const username = values.username?.trim() || current.username;
    const password =
      values.password !== undefined && values.password !== ""
        ? values.password
        : current.password;
    if (username) secrets.username = username;
    if (password) secrets.password = password;
  }

  if (kind === "bearer" && !secrets.token) {
    throw new Error("Enter a bearer token to save.");
  }
  if (kind === "basic" && !secrets.username) {
    throw new Error("Enter a username to save.");
  }

  const secretKeys = Object.keys(secrets);
  const data = {
    // "none" would stop the vault being opened, taking secret headers with it.
    kind: kind === "none" && headerRules.length > 0 ? "header" : kind,
    injection: headerRules as unknown as Prisma.InputJsonValue,
    encryptedSecrets: secretKeys.length > 0 ? encryptSecrets(secrets) : null,
    secretKeys,
  };

  await prisma.authProfile.upsert({
    where: { connectionId },
    create: { connectionId, ...data },
    update: data,
  });

  cacheInvalidateConnection(connectionId);
}

/* ------------------------------------------------------------------ *
 * Testing
 * ------------------------------------------------------------------ */

/**
 * Picks the endpoint most likely to succeed with no user input: a GET with no
 * required parameters beyond credentials, preferring short collection paths.
 */
export async function pickTestOperation(connectionId: string) {
  const operations = await prisma.operation.findMany({
    where: { connectionId, method: "GET" },
    orderBy: { sortOrder: "asc" },
  });

  const authProfile = await prisma.authProfile.findUnique({
    where: { connectionId },
  });
  const credentialNames = new Set(
    ((authProfile?.injection as unknown as InjectionRule[]) ?? []).map(
      (rule) => `${rule.in}:${rule.name}`,
    ),
  );

  const scored = operations
    .map((operation) => {
      const params =
        (operation.params as unknown as ParameterDescriptor[]) ?? [];
      const needed = params.filter(
        (param) =>
          param.required &&
          param.default === undefined &&
          !credentialNames.has(`${param.in}:${param.name}`),
      );
      return { operation, missing: needed.length, depth: operation.path.split("/").length };
    })
    .filter((entry) => entry.missing === 0)
    .sort((a, b) => a.depth - b.depth);

  return scored[0]?.operation ?? null;
}

export interface TestResult {
  ok: boolean;
  message: string;
  detail?: string;
  status?: number | null;
  durationMs?: number;
  rowCount?: number;
  operationLabel?: string;
}

export async function testConnection(connectionId: string): Promise<TestResult> {
  const operation = await pickTestOperation(connectionId);

  if (!operation) {
    return {
      ok: false,
      message:
        "Argent could not find an endpoint it can call without extra information.",
      detail:
        "Every GET endpoint in this API needs at least one value you have not " +
        "supplied yet. You can still build objects and fill those in per object.",
    };
  }

  const result = await executeOperation({
    operationId: operation.id,
    origin: "test",
    noCache: true,
  });

  const label = operation.summary ?? `${operation.method} ${operation.path}`;

  if (!result.ok) {
    return {
      ok: false,
      message: result.error?.message ?? "The test request failed.",
      detail: result.error?.detail,
      status: result.status,
      durationMs: result.durationMs,
      operationLabel: label,
    };
  }

  const count = result.rowCount;

  return {
    ok: true,
    message:
      count === undefined
        ? "Connected successfully."
        : `Connected successfully and read ${count} ${count === 1 ? "record" : "records"}.`,
    status: result.status,
    durationMs: result.durationMs,
    rowCount: count,
    operationLabel: label,
  };
}

/* ------------------------------------------------------------------ *
 * Reads
 * ------------------------------------------------------------------ */

export async function listConnections() {
  const connections = await prisma.connection.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      authProfile: { select: { kind: true, secretKeys: true } },
      _count: { select: { operations: true, dataObjects: true, dashboards: true } },
    },
  });

  return connections;
}

export async function getConnection(id: string) {
  return prisma.connection.findUnique({
    where: { id },
    include: {
      authProfile: true,
      _count: { select: { operations: true, dataObjects: true } },
    },
  });
}

/**
 * Recomputes credential candidates for an existing connection, so the settings
 * page can suggest fields the same way the import wizard does.
 */
export async function credentialCandidatesFor(
  connectionId: string,
): Promise<CredentialCandidate[]> {
  const operations = await prisma.operation.findMany({
    where: { connectionId },
    select: { params: true },
  });

  if (operations.length === 0) return [];

  const counts = new Map<string, CredentialCandidate>();

  for (const operation of operations) {
    const params = (operation.params as unknown as ParameterDescriptor[]) ?? [];
    for (const param of params) {
      if (!param.looksLikeCredential) continue;
      if (param.in !== "query" && param.in !== "header") continue;

      const id = `${param.in}:${param.name}`;
      const existing = counts.get(id);
      if (existing) existing.occurrences += 1;
      else
        counts.set(id, {
          name: param.name,
          in: param.in,
          description: param.description,
          occurrences: 1,
          coverage: 0,
        });
    }
  }

  return [...counts.values()]
    .map((candidate) => ({
      ...candidate,
      coverage: candidate.occurrences / operations.length,
    }))
    .sort((a, b) => b.occurrences - a.occurrences);
}
