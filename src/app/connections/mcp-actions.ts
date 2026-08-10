"use server";

import { revalidatePath } from "next/cache";
import { requireSection } from "@/server/auth/permissions";
import {
  createMcpAccessToken,
  getMcpServerForConnection,
  revokeMcpAccessToken,
  setMcpEnabled,
  setMcpTools,
} from "@/server/mcp/service";
import { prisma } from "@/server/db";

function revalidateConnection(connectionId: string) {
  revalidatePath(`/connections/${connectionId}`);
}

async function assertApiConnection(connectionId: string) {
  const connection = await prisma.connection.findUnique({
    where: { id: connectionId },
    select: { id: true, type: true },
  });
  if (!connection) throw new Error("Connection not found.");
  if (connection.type !== "api") {
    throw new Error("MCP servers are only available for API connections.");
  }
  return connection;
}

export async function enableMcpServerAction(
  connectionId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await requireSection("connections");
    await assertApiConnection(connectionId);
    await setMcpEnabled(connectionId, user.id, true);
    revalidateConnection(connectionId);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not enable MCP.",
    };
  }
}

export async function disableMcpServerAction(
  connectionId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await requireSection("connections");
    await assertApiConnection(connectionId);
    await setMcpEnabled(connectionId, user.id, false);
    revalidateConnection(connectionId);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not disable MCP.",
    };
  }
}

export async function setMcpToolsAction(
  connectionId: string,
  operationIds: string[],
): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await requireSection("connections");
    await assertApiConnection(connectionId);
    await setMcpTools(connectionId, user.id, operationIds);
    revalidateConnection(connectionId);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Could not update MCP tools.",
    };
  }
}

export async function createMcpTokenAction(
  connectionId: string,
  name: string,
): Promise<{
  ok: boolean;
  error?: string;
  rawToken?: string;
  tokenPrefix?: string;
  tokenId?: string;
}> {
  try {
    const user = await requireSection("connections");
    await assertApiConnection(connectionId);
    const token = await createMcpAccessToken(connectionId, user.id, name);
    revalidateConnection(connectionId);
    return {
      ok: true,
      rawToken: token.rawToken,
      tokenPrefix: token.tokenPrefix,
      tokenId: token.id,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not create token.",
    };
  }
}

export async function revokeMcpTokenAction(
  connectionId: string,
  tokenId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireSection("connections");
    await assertApiConnection(connectionId);
    await revokeMcpAccessToken(tokenId, connectionId);
    revalidateConnection(connectionId);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not revoke token.",
    };
  }
}

export async function loadMcpServerStateAction(connectionId: string) {
  await requireSection("connections");
  return getMcpServerForConnection(connectionId);
}
