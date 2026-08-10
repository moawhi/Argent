"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { cacheInvalidateConnection } from "@/server/gateway/cache";
import {
  createConnectionFromSpec,
  fetchSpecFromUrl,
  previewSpec,
  saveConnectionHeaders,
  saveCredentials,
  saveTokenAuth,
  testConnection,
  type TestResult,
} from "@/server/connections/service";
import type { ConnectionHeader } from "@/lib/connections/headers";
import type { IngestResult } from "@/lib/openapi/types";
import { isDemoConnectionId } from "@/server/demo/access";
import { requireAdmin, requireSection } from "@/server/auth/permissions";
import { grantImporterAndAdminAccess } from "@/server/auth/api-grants";

export interface PreviewState {
  ok: boolean;
  error?: string;
  result?: IngestResult;
  rawSpec?: string;
  specFormat?: string;
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Something went wrong reading that document.";
}

/** Step 1 of the wizard: parse a spec and report what was found. */
export async function previewSpecAction(
  input: { source: "text"; text: string } | { source: "url"; url: string },
): Promise<PreviewState> {
  try {
    const raw =
      input.source === "url"
        ? await fetchSpecFromUrl(input.url.trim())
        : input.text;

    if (!raw.trim()) {
      return { ok: false, error: "That file appears to be empty." };
    }

    const result = await previewSpec(raw);
    const specFormat = raw.trim().startsWith("{") ? "json" : "yaml";

    return { ok: true, result, rawSpec: raw, specFormat };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

export interface CreateState {
  ok: boolean;
  error?: string;
  connectionId?: string;
  test?: TestResult;
}

/** Step 3 of the wizard: persist the connection and run a live test. */
export async function createConnectionAction(input: {
  name: string;
  rawSpec: string;
  specFormat: string;
  baseUrl: string;
  credentials: { name: string; in: "query" | "header"; value: string }[];
  allowWrites: boolean;
}): Promise<CreateState> {
  try {
    const user = await requireSection("connections");
    const { connection } = await createConnectionFromSpec({
      name: input.name,
      rawSpec: input.rawSpec,
      specFormat: input.specFormat,
      baseUrl: input.baseUrl,
      credentials: input.credentials,
      readOnly: !input.allowWrites,
    });

    await grantImporterAndAdminAccess(connection.id, user.id);

    const test = await testConnection(connection.id);

    revalidatePath("/connections");
    revalidatePath("/");
    revalidatePath("/users");

    return { ok: true, connectionId: connection.id, test };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

export async function testConnectionAction(
  connectionId: string,
): Promise<TestResult> {
  try {
    const result = await testConnection(connectionId);
    revalidatePath("/connections");
    return result;
  } catch (error) {
    return { ok: false, message: describeError(error) };
  }
}

export async function saveCredentialsAction(
  connectionId: string,
  credentials: { name: string; in: "query" | "header"; value: string }[],
): Promise<{ ok: boolean; error?: string }> {
  try {
    await saveCredentials(connectionId, credentials);
    revalidatePath(`/connections/${connectionId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

export async function saveConnectionHeadersAction(
  connectionId: string,
  headers: ConnectionHeader[],
): Promise<{ ok: boolean; error?: string }> {
  try {
    await saveConnectionHeaders(connectionId, headers);
    revalidatePath(`/connections/${connectionId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

export async function saveTokenAuthAction(
  connectionId: string,
  kind: "bearer" | "basic" | "none",
  values: { token?: string; username?: string; password?: string },
): Promise<{ ok: boolean; error?: string }> {
  try {
    await saveTokenAuth(connectionId, kind, values);
    revalidatePath(`/connections/${connectionId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

export async function updateConnectionAction(
  connectionId: string,
  data: { name?: string; baseUrl?: string; readOnly?: boolean },
): Promise<{ ok: boolean; error?: string }> {
  try {
    await prisma.connection.update({
      where: { id: connectionId },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.baseUrl !== undefined
          ? { baseUrl: data.baseUrl.trim().replace(/\/+$/, "") }
          : {}),
        ...(data.readOnly !== undefined ? { readOnly: data.readOnly } : {}),
      },
    });

    cacheInvalidateConnection(connectionId);
    revalidatePath(`/connections/${connectionId}`);
    revalidatePath("/connections");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

export async function deleteConnectionAction(
  connectionId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    // Only admins may permanently remove the bundled demo connection.
    if (await isDemoConnectionId(connectionId)) {
      await requireAdmin();
    }

    await prisma.connection.delete({ where: { id: connectionId } });
    cacheInvalidateConnection(connectionId);
    revalidatePath("/connections");
    revalidatePath("/");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}
