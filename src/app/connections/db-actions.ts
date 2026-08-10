"use server";

import { revalidatePath } from "next/cache";
import {
  createDatabaseConnection,
  deleteSqlOperation,
  getDbCatalog,
  listSqlOperations,
  refreshDbCatalog,
  saveSqlOperation,
  testDatabaseConnection,
  updateDatabaseConnection,
  type DbConfig,
} from "@/server/database/service";
import { executeAdHocSql } from "@/server/database/executor";
import type { ExecuteResponseBody } from "@/lib/gateway/types";
import { requireSection } from "@/server/auth/permissions";
import { grantImporterAndAdminAccess } from "@/server/auth/api-grants";

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export async function createDatabaseConnectionAction(input: {
  name: string;
  config: DbConfig;
  password: string;
  readOnly?: boolean;
  description?: string;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const user = await requireSection("connections");
    const connection = await createDatabaseConnection(input);
    await grantImporterAndAdminAccess(connection.id, user.id);
    revalidatePath("/connections");
    revalidatePath(`/connections/${connection.id}`);
    revalidatePath("/users");
    return { ok: true, id: connection.id };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

export async function updateDatabaseConnectionAction(
  connectionId: string,
  input: {
    name?: string;
    config?: DbConfig;
    password?: string;
    readOnly?: boolean;
    description?: string;
  },
): Promise<{ ok: boolean; error?: string }> {
  try {
    await updateDatabaseConnection(connectionId, input);
    revalidatePath(`/connections/${connectionId}`);
    revalidatePath("/connections");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

export async function testDatabaseConnectionAction(
  connectionId: string,
): Promise<{ ok: boolean; message: string }> {
  const result = await testDatabaseConnection(connectionId);
  revalidatePath(`/connections/${connectionId}`);
  return result;
}

export async function refreshDbCatalogAction(
  connectionId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await refreshDbCatalog(connectionId);
    revalidatePath(`/connections/${connectionId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

export async function getDbCatalogAction(connectionId: string) {
  return getDbCatalog(connectionId);
}

export async function saveSqlOperationAction(input: {
  connectionId: string;
  id?: string;
  name: string;
  sqlTemplate: string;
  description?: string;
  tags?: string[];
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const operation = await saveSqlOperation(input);
    revalidatePath(`/connections/${input.connectionId}`);
    revalidatePath("/objects");
    return { ok: true, id: operation.id };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

export async function listSqlOperationsAction(connectionId: string) {
  return listSqlOperations(connectionId);
}

export async function deleteSqlOperationAction(
  connectionId: string,
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await deleteSqlOperation(id);
    revalidatePath(`/connections/${connectionId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

export async function runSqlAction(input: {
  connectionId: string;
  sql: string;
  params?: Record<string, unknown>;
  confirmWrite?: boolean;
}): Promise<ExecuteResponseBody> {
  return executeAdHocSql({
    ...input,
    origin: "tryIt",
  });
}
