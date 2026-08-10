import "server-only";

import { prisma } from "@/server/db";
import { redact } from "@/server/crypto";
import { truncateForLog } from "@/server/auth/api-grants";
import {
  FETCH_LIMITS,
  applyPaginationToParams,
  normalizePagination,
} from "@/lib/gateway/pagination";
import type {
  ExecuteRequestBody,
  ExecuteResponseBody,
  GatewayError,
} from "@/lib/gateway/types";
import type { FieldDescriptor } from "@/lib/openapi/types";
import { applyRowCap } from "@/server/gateway/row-limits";
import { getAdapter } from "./adapters";
import { extractParamNames, isReadOnlySql, isWriteSql } from "./sql";
import { loadDbConnection } from "./service";

const TIMEOUT_MS = 30_000;

function fail(
  error: GatewayError,
  extras: Partial<ExecuteResponseBody> = {},
): ExecuteResponseBody {
  return {
    ok: false,
    status: null,
    durationMs: extras.durationMs ?? 0,
    contentType: "application/json",
    error,
    ...extras,
  };
}

/**
 * Runs a saved SQL operation through the matching database adapter and returns
 * the same shape the HTTP gateway uses, so objects render unchanged.
 */
export async function executeSqlOperation(
  body: ExecuteRequestBody & {
    operationId: string;
    connectionId: string;
    userId?: string;
  },
): Promise<ExecuteResponseBody> {
  const operation = await prisma.operation.findUnique({
    where: { id: body.operationId },
  });

  if (!operation || !operation.sqlTemplate) {
    return fail({
      kind: "notFound",
      message: "That query no longer exists.",
    });
  }

  let connection;
  try {
    connection = await loadDbConnection(body.connectionId);
  } catch (error) {
    return fail({
      kind: "config",
      message:
        error instanceof Error
          ? error.message
          : "The database connection could not be opened.",
    });
  }

  const sql = operation.sqlTemplate;
  const write = isWriteSql(sql);

  if (connection.readOnly && !isReadOnlySql(sql)) {
    return fail({
      kind: "readOnly",
      message: `“${connection.name}” is in read-only mode, so this query was not run.`,
      detail:
        "Open the connection's settings and turn on “Allow changes”, or rewrite the query as a SELECT.",
    });
  }

  if (write && !body.confirmWrite) {
    return fail({
      kind: "config",
      message: "This query changes data and needs an explicit confirmation.",
    });
  }

  const pagination = body.pagination
    ? normalizePagination(body.pagination, FETCH_LIMITS.hardMax)
    : { limit: FETCH_LIMITS.hardMax, offset: 0 };
  const declaredParams =
    (operation.params as { name?: string }[] | null)?.map(
      (entry) => entry.name ?? "",
    ).filter(Boolean) ?? [];
  const paramNames = [...new Set([...extractParamNames(sql), ...declaredParams])];
  const params = applyPaginationToParams(
    body.params ?? {},
    pagination,
    paramNames,
    { overwrite: Boolean(body.pagination) },
  );
  const adapter = getAdapter(connection.config.engine);
  const startedAt = Date.now();

  try {
    const result = await adapter.query(
      connection.config,
      connection.secrets,
      sql,
      params,
      {
        maxRows: pagination.limit,
        offset: pagination.offset,
        timeoutMs: TIMEOUT_MS,
      },
    );

    const durationMs = Date.now() - startedAt;
    const secretsBag: Record<string, string> = {};
    if (connection.secrets.password) {
      secretsBag.password = connection.secrets.password;
    }
    const previewSql = redact(result.previewSql, secretsBag);

    const fields = fieldsFromRows(result.rows, result.fields);
    const normalized = {
      kind: "collection" as const,
      data: result.rows,
      rows: result.rows,
      fields,
      envelope: undefined as Record<string, unknown> | undefined,
    };

    await prisma.requestLog
      .create({
        data: {
          connectionId: connection.id,
          operationId: operation.id,
          userId: body.userId,
          method: operation.method,
          url: previewSql.slice(0, 2000),
          status: 200,
          ok: true,
          durationMs,
          responseBytes: Buffer.byteLength(JSON.stringify(result.rows)),
          requestParams: truncateForLog(body.params ?? null) ?? undefined,
          requestBody: truncateForLog(previewSql) ?? undefined,
          responseBody:
            truncateForLog(result.rows.slice(0, 50)) ?? undefined,
          origin: body.origin ?? "gateway",
        },
      })
      .catch(() => {});

    await prisma.connection
      .update({
        where: { id: connection.id },
        data: {
          status: "healthy",
          lastCheckedAt: new Date(),
          lastError: null,
        },
      })
      .catch(() => {});

    return applyRowCap(
      {
        ok: true,
        status: 200,
        durationMs,
        contentType: "application/json",
        data: normalized.data,
        rows: normalized.rows,
        fields: normalized.fields,
        responseKind: normalized.kind,
        rowCount: result.rowCount,
        requestPreview: {
          method: operation.method,
          url: previewSql,
          headers: {},
        },
      },
      pagination,
    );
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const message =
      error instanceof Error ? error.message : "The database rejected the query.";

    await prisma.requestLog
      .create({
        data: {
          connectionId: connection.id,
          operationId: operation.id,
          userId: body.userId,
          method: operation.method,
          url: sql.slice(0, 500),
          status: null,
          ok: false,
          durationMs,
          error: message,
          requestParams: truncateForLog(body.params ?? null) ?? undefined,
          origin: body.origin ?? "gateway",
        },
      })
      .catch(() => {});

    await prisma.connection
      .update({
        where: { id: connection.id },
        data: {
          status: "failing",
          lastCheckedAt: new Date(),
          lastError: message,
        },
      })
      .catch(() => {});

    return fail(
      {
        kind: "upstreamError",
        message: "The database rejected that query.",
        detail: message,
      },
      { durationMs },
    );
  }
}

/** Ad-hoc run from the SQL editor (not yet saved, or saved with overrides). */
export async function executeAdHocSql(input: {
  connectionId: string;
  sql: string;
  params?: Record<string, unknown>;
  confirmWrite?: boolean;
  origin?: ExecuteRequestBody["origin"];
}): Promise<ExecuteResponseBody> {
  let connection;
  try {
    connection = await loadDbConnection(input.connectionId);
  } catch (error) {
    return fail({
      kind: "config",
      message:
        error instanceof Error
          ? error.message
          : "The database connection could not be opened.",
    });
  }

  const sql = input.sql.trim();
  if (!sql) {
    return fail({
      kind: "config",
      message: "Write a SQL query first.",
    });
  }

  if (connection.readOnly && !isReadOnlySql(sql)) {
    return fail({
      kind: "readOnly",
      message: `“${connection.name}” is in read-only mode, so this query was not run.`,
    });
  }

  if (isWriteSql(sql) && !input.confirmWrite) {
    return fail({
      kind: "config",
      message: "This query changes data and needs an explicit confirmation.",
    });
  }

  const pagination = { limit: FETCH_LIMITS.hardMax, offset: 0 };
  const paramNames = extractParamNames(sql);
  const params = applyPaginationToParams(
    input.params ?? {},
    pagination,
    paramNames,
    { overwrite: false },
  );
  const adapter = getAdapter(connection.config.engine);
  const startedAt = Date.now();

  try {
    const result = await adapter.query(
      connection.config,
      connection.secrets,
      sql,
      params,
      {
        maxRows: pagination.limit,
        offset: pagination.offset,
        timeoutMs: TIMEOUT_MS,
      },
    );
    const durationMs = Date.now() - startedAt;
    const secretsBag: Record<string, string> = {};
    if (connection.secrets.password) {
      secretsBag.password = connection.secrets.password;
    }
    const previewSql = redact(result.previewSql, secretsBag);
    const fields = fieldsFromRows(result.rows, result.fields);

    await prisma.requestLog
      .create({
        data: {
          connectionId: connection.id,
          method: "SQL",
          url: previewSql.slice(0, 2000),
          status: 200,
          ok: true,
          durationMs,
          origin: input.origin ?? "tryIt",
        },
      })
      .catch(() => {});

    return applyRowCap(
      {
        ok: true,
        status: 200,
        durationMs,
        contentType: "application/json",
        data: result.rows,
        rows: result.rows,
        fields,
        responseKind: "collection",
        rowCount: result.rowCount,
        requestPreview: {
          method: "SQL",
          url: previewSql,
          headers: {},
        },
      },
      pagination,
    );
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    return fail(
      {
        kind: "upstreamError",
        message: "The database rejected that query.",
        detail:
          error instanceof Error ? error.message : "Unknown database error.",
      },
      { durationMs },
    );
  }
}

function fieldsFromRows(
  rows: Record<string, unknown>[],
  meta: { name: string; type?: string }[],
): FieldDescriptor[] {
  if (rows.length > 0) return inferFromSample(rows[0]);

  return meta.map((field) => ({
    path: field.name,
    key: field.name,
    label: field.name,
    type: "string" as const,
    semantic: "text" as const,
    required: false,
    nullable: true,
    readOnly: false,
    depth: 0,
  }));
}

function inferFromSample(row: Record<string, unknown>): FieldDescriptor[] {
  return Object.entries(row).map(([key, value]) => {
    if (typeof value === "number") {
      return {
        path: key,
        key,
        label: key,
        type: "number" as const,
        semantic: "number" as const,
        required: false,
        nullable: false,
        readOnly: false,
        depth: 0,
      } satisfies FieldDescriptor;
    }
    if (typeof value === "boolean") {
      return {
        path: key,
        key,
        label: key,
        type: "boolean" as const,
        semantic: "boolean" as const,
        required: false,
        nullable: false,
        readOnly: false,
        depth: 0,
      } satisfies FieldDescriptor;
    }
    return {
      path: key,
      key,
      label: key,
      type: "string" as const,
      semantic: "text" as const,
      required: false,
      nullable: value === null,
      readOnly: false,
      depth: 0,
    } satisfies FieldDescriptor;
  });
}
