"use server";

import { revalidatePath } from "next/cache";
import { requireSection } from "@/server/auth/permissions";
import {
  createMcpAccessToken,
  createMcpServer,
  deleteMcpServer,
  getMcpServerById,
  revokeMcpAccessToken,
  setMcpTools,
  updateMcpServer,
} from "@/server/mcp/service";

function revalidateMcp(id?: string) {
  revalidatePath("/mcp");
  if (id) revalidatePath(`/mcp/${id}`);
}

export async function createMcpServerAction(input: {
  name: string;
}): Promise<{ ok: boolean; error?: string; id?: string }> {
  try {
    const user = await requireSection("connections");
    const server = await createMcpServer({
      name: input.name,
      userId: user.id,
    });
    revalidateMcp(server.id);
    return { ok: true, id: server.id };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not create MCP server.",
    };
  }
}

export async function updateMcpServerAction(
  id: string,
  data: { name?: string; enabled?: boolean },
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireSection("connections");
    await updateMcpServer(id, data);
    revalidateMcp(id);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not update MCP server.",
    };
  }
}

export async function deleteMcpServerAction(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireSection("connections");
    await deleteMcpServer(id);
    revalidateMcp();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not delete MCP server.",
    };
  }
}

export async function setMcpToolsAction(
  mcpServerId: string,
  operationIds: string[],
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireSection("connections");
    await setMcpTools(mcpServerId, operationIds);
    revalidateMcp(mcpServerId);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not update tools.",
    };
  }
}

export async function createMcpTokenAction(
  mcpServerId: string,
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
    const token = await createMcpAccessToken(mcpServerId, user.id, name);
    revalidateMcp(mcpServerId);
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
  mcpServerId: string,
  tokenId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireSection("connections");
    await revokeMcpAccessToken(tokenId, mcpServerId);
    revalidateMcp(mcpServerId);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not revoke token.",
    };
  }
}

export async function loadMcpServerAction(id: string) {
  await requireSection("connections");
  return getMcpServerById(id);
}
