import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { decryptSecrets, encryptSecrets } from "@/server/crypto";
import { slugify } from "@/lib/utils";
import { getAdapter } from "./adapters";
import { dbHostAllowed } from "./host";
import {
  extractParamNames,
  isReadOnlySql,
  sqlVerb,
} from "./sql";
import {
  displayBaseUrl,
  ENGINE_DEFAULTS,
  type DbConfig,
  type DbEngine,
  type DbSchema,
  type DbSecrets,
} from "./types";
import type { ParameterDescriptor } from "@/lib/openapi/types";

export interface CreateDatabaseInput {
  name: string;
  config: DbConfig;
  password: string;
  readOnly?: boolean;
  description?: string;
}

function assertConfig(config: DbConfig) {
  if (!config.host?.trim()) throw new Error("Enter a host name.");
  if (!config.database?.trim()) throw new Error("Enter a database name.");
  if (!config.user?.trim()) throw new Error("Enter a username.");
  if (!Number.isFinite(config.port) || config.port <= 0) {
    throw new Error("Enter a valid port number.");
  }
  if (!ENGINE_DEFAULTS[config.engine]) {
    throw new Error(`Unsupported engine: ${config.engine}`);
  }
  if (!dbHostAllowed(config.host.trim())) {
    throw new Error(
      `Connections to ${config.host} are not allowed. Add it to GATEWAY_ALLOWED_HOSTS.`,
    );
  }
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = slugify(base) || "database";
  let attempt = 0;
  while (await prisma.connection.findUnique({ where: { slug } })) {
    attempt += 1;
    slug = `${slugify(base)}-${attempt}`;
  }
  return slug;
}

export async function createDatabaseConnection(input: CreateDatabaseInput) {
  assertConfig(input.config);

  const adapter = getAdapter(input.config.engine);
  await adapter.testConnection(input.config, { password: input.password });

  const schemas = await adapter.introspect(input.config, {
    password: input.password,
  });

  const name = input.name.trim();
  const slug = await uniqueSlug(name);
  const baseUrl = displayBaseUrl(input.config);

  const connection = await prisma.connection.create({
    data: {
      name,
      slug,
      description: input.description?.trim() || null,
      type: "database",
      baseUrl,
      dbConfig: input.config as unknown as Prisma.InputJsonValue,
      readOnly: input.readOnly ?? true,
      status: "healthy",
      lastCheckedAt: new Date(),
      lastError: null,
      authProfile: {
        create: {
          kind: "database",
          injection: [],
          encryptedSecrets: encryptSecrets({ password: input.password }),
          secretKeys: ["password"],
        },
      },
      dbCatalog: {
        create: {
          schemas: schemas as unknown as Prisma.InputJsonValue,
          refreshedAt: new Date(),
        },
      },
    },
    include: { dbCatalog: true, authProfile: true },
  });

  return connection;
}

export async function updateDatabaseConnection(
  connectionId: string,
  input: {
    name?: string;
    config?: DbConfig;
    password?: string;
    readOnly?: boolean;
    description?: string;
  },
) {
  const existing = await prisma.connection.findUnique({
    where: { id: connectionId },
    include: { authProfile: true },
  });
  if (!existing || existing.type !== "database") {
    throw new Error("That database connection no longer exists.");
  }

  const config = (input.config ??
    (existing.dbConfig as unknown as DbConfig)) as DbConfig;
  assertConfig(config);

  const currentSecrets = existing.authProfile
    ? decryptSecrets(existing.authProfile.encryptedSecrets)
    : {};
  const secrets: DbSecrets = {
    password: input.password?.trim() || currentSecrets.password,
  };

  if (!secrets.password) {
    throw new Error("A password is required for this database.");
  }

  const adapter = getAdapter(config.engine);
  await adapter.testConnection(config, secrets);

  const data: Prisma.ConnectionUpdateInput = {
    baseUrl: displayBaseUrl(config),
    dbConfig: config as unknown as Prisma.InputJsonValue,
    status: "healthy",
    lastCheckedAt: new Date(),
    lastError: null,
  };

  if (input.name !== undefined) data.name = input.name.trim();
  if (input.description !== undefined) {
    data.description = input.description.trim() || null;
  }
  if (input.readOnly !== undefined) data.readOnly = input.readOnly;

  await prisma.connection.update({ where: { id: connectionId }, data });

  if (input.password?.trim()) {
    await prisma.authProfile.upsert({
      where: { connectionId },
      create: {
        connectionId,
        kind: "database",
        injection: [],
        encryptedSecrets: encryptSecrets({ password: input.password.trim() }),
        secretKeys: ["password"],
      },
      update: {
        kind: "database",
        encryptedSecrets: encryptSecrets({ password: input.password.trim() }),
        secretKeys: ["password"],
      },
    });
  }

  return prisma.connection.findUnique({
    where: { id: connectionId },
    include: { dbCatalog: true, authProfile: true },
  });
}

export async function testDatabaseConnection(connectionId: string) {
  const connection = await loadDbConnection(connectionId);
  const adapter = getAdapter(connection.config.engine);

  try {
    await adapter.testConnection(connection.config, connection.secrets);
    await prisma.connection.update({
      where: { id: connectionId },
      data: {
        status: "healthy",
        lastCheckedAt: new Date(),
        lastError: null,
      },
    });
    return {
      ok: true as const,
      message: `${ENGINE_DEFAULTS[connection.config.engine].label} answered.`,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not reach the database.";
    await prisma.connection.update({
      where: { id: connectionId },
      data: {
        status: "failing",
        lastCheckedAt: new Date(),
        lastError: message,
      },
    });
    return { ok: false as const, message };
  }
}

export async function refreshDbCatalog(connectionId: string) {
  const connection = await loadDbConnection(connectionId);
  const adapter = getAdapter(connection.config.engine);
  const schemas = await adapter.introspect(
    connection.config,
    connection.secrets,
  );

  await prisma.dbCatalog.upsert({
    where: { connectionId },
    create: {
      connectionId,
      schemas: schemas as unknown as Prisma.InputJsonValue,
      refreshedAt: new Date(),
    },
    update: {
      schemas: schemas as unknown as Prisma.InputJsonValue,
      refreshedAt: new Date(),
    },
  });

  await prisma.connection.update({
    where: { id: connectionId },
    data: {
      status: "healthy",
      lastCheckedAt: new Date(),
      lastError: null,
    },
  });

  return schemas;
}

export async function getDbCatalog(
  connectionId: string,
): Promise<{ schemas: DbSchema[]; refreshedAt: Date | null }> {
  const catalog = await prisma.dbCatalog.findUnique({
    where: { connectionId },
  });
  return {
    schemas: (catalog?.schemas as unknown as DbSchema[]) ?? [],
    refreshedAt: catalog?.refreshedAt ?? null,
  };
}

export interface SaveSqlOperationInput {
  connectionId: string;
  id?: string;
  name: string;
  sqlTemplate: string;
  description?: string;
  tags?: string[];
}

function paramsFromSql(sql: string): ParameterDescriptor[] {
  return extractParamNames(sql).map((name) => ({
    name,
    in: "query",
    required: true,
    type: "string",
    semantic: "text",
    description: `Value for {{${name}}}`,
  }));
}

export async function saveSqlOperation(input: SaveSqlOperationInput) {
  const connection = await prisma.connection.findUnique({
    where: { id: input.connectionId },
  });
  if (!connection || connection.type !== "database") {
    throw new Error("Pick a database connection first.");
  }

  const sql = input.sqlTemplate.trim();
  if (!sql) throw new Error("Write a SQL query first.");

  const name = input.name.trim();
  if (!name) throw new Error("Give this query a name.");

  const operationKey = slugify(name) || `query_${Date.now().toString(36)}`;
  const method = isReadOnlySql(sql) ? "SELECT" : sqlVerb(sql);
  const params = paramsFromSql(sql);

  const data = {
    method,
    path: `/${operationKey}`,
    summary: name,
    description: input.description?.trim() || null,
    tags: input.tags?.length ? input.tags : ["Queries"],
    params: params as unknown as Prisma.InputJsonValue,
    sqlTemplate: sql,
    source: "sql",
  };

  if (input.id) {
    return prisma.operation.update({
      where: { id: input.id },
      data,
    });
  }

  // Avoid unique collisions on re-save of similarly named queries.
  let key = operationKey;
  let attempt = 0;
  while (
    await prisma.operation.findUnique({
      where: {
        connectionId_operationKey: {
          connectionId: input.connectionId,
          operationKey: key,
        },
      },
    })
  ) {
    attempt += 1;
    key = `${operationKey}_${attempt}`;
  }

  return prisma.operation.create({
    data: {
      connectionId: input.connectionId,
      operationKey: key,
      ...data,
    },
  });
}

export async function listSqlOperations(connectionId: string) {
  return prisma.operation.findMany({
    where: { connectionId, source: "sql" },
    orderBy: { updatedAt: "desc" },
  });
}

export async function deleteSqlOperation(id: string) {
  await prisma.operation.delete({ where: { id } });
}

export async function loadDbConnection(connectionId: string): Promise<{
  id: string;
  name: string;
  readOnly: boolean;
  config: DbConfig;
  secrets: DbSecrets;
}> {
  const connection = await prisma.connection.findUnique({
    where: { id: connectionId },
    include: { authProfile: true },
  });

  if (!connection || connection.type !== "database") {
    throw new Error("That database connection no longer exists.");
  }

  const config = connection.dbConfig as unknown as DbConfig | null;
  if (!config?.engine) {
    throw new Error("This connection is missing its database settings.");
  }

  if (!dbHostAllowed(config.host)) {
    throw new Error(
      `Connections to ${config.host} are not allowed. Add it to GATEWAY_ALLOWED_HOSTS.`,
    );
  }

  const secrets: DbSecrets = connection.authProfile
    ? decryptSecrets(connection.authProfile.encryptedSecrets)
    : {};

  return {
    id: connection.id,
    name: connection.name,
    readOnly: connection.readOnly,
    config,
    secrets,
  };
}

export type { DbConfig, DbEngine, DbSchema };
