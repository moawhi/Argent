import "server-only";

import { prisma } from "@/server/db";
import type { SessionUser } from "@/server/auth/acl";
import {
  canCallOperation,
  logDeniedApiCall,
} from "@/server/auth/api-grants";
import { executeOperation } from "@/server/gateway/executor";
import type { ParameterDescriptor } from "@/lib/openapi/types";
import { isThemeId } from "@/lib/theme";
import { slugify } from "@/lib/utils";
import {
  buildToolInputSchema,
  formatToolResult,
  splitToolArgs,
  toolDescription,
  uniqueToolNames,
} from "@/server/mcp/tools";
import { hashMcpToken, mintMcpToken } from "@/server/mcp/tokens";

export type McpSessionAuth = {
  tokenId: string;
  userId: string;
  mcpServerId: string;
  slug: string;
  user: SessionUser;
};

export function slugifyMcpName(name: string): string {
  return slugify(name).slice(0, 48) || "mcp-server";
}

export async function loadSessionUserById(
  userId: string,
): Promise<SessionUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      role: { include: { sectionGrants: true } },
      sectionGrants: true,
    },
  });
  if (!user || !user.active) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    active: user.active,
    theme: isThemeId(user.theme) ? user.theme : "light",
    mustChangePassword: user.mustChangePassword,
    onboardingCompletedAt: user.onboardingCompletedAt,
    hideDemo: user.hideDemo,
    role: {
      id: user.role.id,
      key: user.role.key,
      label: user.role.label,
    },
    roleSections: user.role.sectionGrants.map((g) => g.section),
    sectionOverrides: user.sectionGrants.map((g) => g.section),
  };
}

const serverInclude = {
  tools: {
    include: {
      operation: {
        select: {
          id: true,
          connectionId: true,
          operationKey: true,
          method: true,
          path: true,
          summary: true,
          description: true,
          tags: true,
          params: true,
          requestSchema: true,
          source: true,
          deprecated: true,
          connection: { select: { id: true, name: true, slug: true, type: true } },
        },
      },
    },
  },
  tokens: {
    where: { revokedAt: null },
    orderBy: { createdAt: "desc" as const },
    select: {
      id: true,
      name: true,
      tokenPrefix: true,
      createdAt: true,
      lastUsedAt: true,
      createdBy: { select: { id: true, name: true, email: true } },
    },
  },
  _count: { select: { tools: true, tokens: true } },
};

export async function listMcpServers() {
  return prisma.mcpServer.findMany({
    orderBy: [{ isSample: "desc" }, { updatedAt: "desc" }],
    include: {
      _count: { select: { tools: true, tokens: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });
}

export async function getMcpServerById(id: string) {
  return prisma.mcpServer.findUnique({
    where: { id },
    include: serverInclude,
  });
}

export async function getMcpServerBySlug(slug: string) {
  return prisma.mcpServer.findUnique({
    where: { slug },
    include: serverInclude,
  });
}

async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  let candidate = base;
  let n = 2;
  for (;;) {
    const existing = await prisma.mcpServer.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing || existing.id === excludeId) return candidate;
    candidate = `${base.slice(0, 40)}-${n}`;
    n += 1;
  }
}

export async function createMcpServer(input: {
  name: string;
  userId: string;
  slug?: string;
}) {
  const name = input.name.trim();
  if (!name) throw new Error("Give the MCP server a name.");
  const slug = await uniqueSlug(slugifyMcpName(input.slug ?? name));

  return prisma.mcpServer.create({
    data: {
      name,
      slug,
      enabled: true,
      createdById: input.userId,
    },
  });
}

export async function updateMcpServer(
  id: string,
  data: { name?: string; enabled?: boolean },
) {
  const patch: { name?: string; enabled?: boolean } = {};
  if (data.name !== undefined) {
    const name = data.name.trim();
    if (!name) throw new Error("Give the MCP server a name.");
    patch.name = name;
  }
  if (data.enabled !== undefined) patch.enabled = data.enabled;

  return prisma.mcpServer.update({
    where: { id },
    data: patch,
  });
}

export async function deleteMcpServer(id: string) {
  await prisma.mcpServer.delete({ where: { id } });
}

export async function setMcpTools(mcpServerId: string, operationIds: string[]) {
  const server = await prisma.mcpServer.findUnique({
    where: { id: mcpServerId },
    select: { id: true },
  });
  if (!server) throw new Error("MCP server not found.");

  const uniqueIds = [...new Set(operationIds)];
  if (uniqueIds.length > 0) {
    const ops = await prisma.operation.findMany({
      where: {
        id: { in: uniqueIds },
        source: { not: "sql" },
        connection: { type: "api" },
      },
      select: { id: true },
    });
    if (ops.length !== uniqueIds.length) {
      throw new Error(
        "One or more operations are missing or are not from an API connection.",
      );
    }
  }

  await prisma.$transaction([
    prisma.mcpServerTool.deleteMany({ where: { mcpServerId } }),
    ...(uniqueIds.length
      ? [
          prisma.mcpServerTool.createMany({
            data: uniqueIds.map((operationId) => ({
              mcpServerId,
              operationId,
            })),
          }),
        ]
      : []),
  ]);

  return getMcpServerById(mcpServerId);
}

export async function createMcpAccessToken(
  mcpServerId: string,
  userId: string,
  name: string,
) {
  const server = await prisma.mcpServer.findUnique({
    where: { id: mcpServerId },
    select: { id: true },
  });
  if (!server) throw new Error("MCP server not found.");

  const minted = mintMcpToken();
  const label = name.trim() || "MCP client";

  const token = await prisma.mcpAccessToken.create({
    data: {
      mcpServerId,
      name: label,
      tokenHash: minted.hash,
      tokenPrefix: minted.prefix,
      createdById: userId,
    },
  });

  return {
    id: token.id,
    name: token.name,
    tokenPrefix: token.tokenPrefix,
    rawToken: minted.raw,
    createdAt: token.createdAt,
  };
}

export async function revokeMcpAccessToken(
  tokenId: string,
  mcpServerId: string,
) {
  const token = await prisma.mcpAccessToken.findUnique({
    where: { id: tokenId },
    select: { id: true, mcpServerId: true },
  });
  if (!token || token.mcpServerId !== mcpServerId) {
    throw new Error("Token not found.");
  }
  await prisma.mcpAccessToken.update({
    where: { id: tokenId },
    data: { revokedAt: new Date() },
  });
}

export async function verifyMcpBearer(
  slug: string,
  bearerToken: string | undefined,
): Promise<McpSessionAuth | null> {
  if (!bearerToken) return null;

  const hash = hashMcpToken(bearerToken);
  const token = await prisma.mcpAccessToken.findUnique({
    where: { tokenHash: hash },
    include: {
      mcpServer: {
        select: { id: true, enabled: true, slug: true },
      },
    },
  });

  if (!token || token.revokedAt) return null;
  if (!token.mcpServer.enabled) return null;
  if (token.mcpServer.slug !== slug) return null;

  const user = await loadSessionUserById(token.createdById);
  if (!user) return null;

  void prisma.mcpAccessToken
    .update({
      where: { id: token.id },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => undefined);

  return {
    tokenId: token.id,
    userId: user.id,
    mcpServerId: token.mcpServer.id,
    slug: token.mcpServer.slug,
    user,
  };
}

export type McpToolDefinition = {
  operationId: string;
  name: string;
  description: string;
  method: string;
  path: string;
  connectionSlug: string;
  inputSchema: ReturnType<typeof buildToolInputSchema>;
};

export async function listEnabledMcpToolsBySlug(
  slug: string,
): Promise<{ serverName: string; tools: McpToolDefinition[] } | null> {
  const server = await prisma.mcpServer.findUnique({
    where: { slug },
    include: {
      tools: {
        include: {
          operation: {
            select: {
              id: true,
              operationKey: true,
              method: true,
              path: true,
              summary: true,
              description: true,
              params: true,
              requestSchema: true,
              deprecated: true,
              connection: { select: { slug: true, type: true } },
            },
          },
        },
      },
    },
  });

  if (!server?.enabled) return null;

  const operations = server.tools
    .map((t) => t.operation)
    .filter((op) => !op.deprecated && op.connection.type === "api");

  const names = uniqueToolNames(
    operations.map((op) => ({
      id: op.id,
      operationKey: op.operationKey,
      connectionSlug: op.connection.slug,
    })),
  );

  return {
    serverName: server.name,
    tools: operations.map((op) => {
      const params = (op.params as unknown as ParameterDescriptor[]) ?? [];
      return {
        operationId: op.id,
        name: names.get(op.id)!,
        description: toolDescription(op),
        method: op.method,
        path: op.path,
        connectionSlug: op.connection.slug,
        inputSchema: buildToolInputSchema(params, op.requestSchema),
      };
    }),
  };
}

export async function invokeMcpTool(opts: {
  auth: McpSessionAuth;
  operationId: string;
  args: Record<string, unknown>;
}): Promise<{ ok: boolean; text: string }> {
  const { auth, operationId, args } = opts;

  const link = await prisma.mcpServerTool.findUnique({
    where: {
      mcpServerId_operationId: {
        mcpServerId: auth.mcpServerId,
        operationId,
      },
    },
    include: {
      operation: {
        select: {
          id: true,
          connectionId: true,
          method: true,
          path: true,
        },
      },
    },
  });

  if (!link) {
    return {
      ok: false,
      text: "This tool is not enabled on this MCP server.",
    };
  }

  const connectionId = link.operation.connectionId;
  const allowed = await canCallOperation(
    auth.user,
    connectionId,
    operationId,
  );
  if (!allowed) {
    await logDeniedApiCall({
      userId: auth.userId,
      connectionId,
      operationId,
      method: link.operation.method,
      path: link.operation.path,
      origin: "mcp",
      params: args,
    });
    return {
      ok: false,
      text: "You do not have permission to call this API endpoint.",
    };
  }

  const { params, body } = splitToolArgs(args);
  const isWrite = link.operation.method.toUpperCase() !== "GET";

  const result = await executeOperation({
    operationId,
    params,
    body,
    origin: "mcp",
    confirmWrite: isWrite ? true : undefined,
    noCache: true,
    userId: auth.userId,
  });

  if (!result.ok) {
    return {
      ok: false,
      text: formatToolResult({
        error: result.error,
        status: result.status,
      }),
    };
  }

  return {
    ok: true,
    text: formatToolResult({
      status: result.status,
      durationMs: result.durationMs,
      data: result.data ?? result.rows,
      envelope: result.envelope,
    }),
  };
}

/** Operations available to pick as MCP tools, grouped for the editor. */
export async function listApiOperationsForPicker() {
  return prisma.operation.findMany({
    where: {
      source: { not: "sql" },
      connection: { type: "api" },
    },
    orderBy: [{ connectionId: "asc" }, { sortOrder: "asc" }, { path: "asc" }],
    select: {
      id: true,
      operationKey: true,
      method: true,
      path: true,
      summary: true,
      tags: true,
      connectionId: true,
      connection: { select: { id: true, name: true, slug: true } },
    },
  });
}
