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
  connectionId: string;
  user: SessionUser;
};

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

export async function verifyMcpBearer(
  connectionId: string,
  bearerToken: string | undefined,
): Promise<McpSessionAuth | null> {
  if (!bearerToken) return null;

  const hash = hashMcpToken(bearerToken);
  const token = await prisma.mcpAccessToken.findUnique({
    where: { tokenHash: hash },
    include: {
      mcpServer: {
        select: {
          id: true,
          enabled: true,
          connectionId: true,
          connection: { select: { type: true } },
        },
      },
    },
  });

  if (!token || token.revokedAt) return null;
  if (!token.mcpServer.enabled) return null;
  if (token.mcpServer.connectionId !== connectionId) return null;
  if (token.mcpServer.connection.type !== "api") return null;

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
    connectionId: token.mcpServer.connectionId,
    user,
  };
}

export async function getMcpServerForConnection(connectionId: string) {
  return prisma.mcpServer.findUnique({
    where: { connectionId },
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
              tags: true,
              params: true,
              requestSchema: true,
              source: true,
              deprecated: true,
            },
          },
        },
      },
      tokens: {
        where: { revokedAt: null },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          tokenPrefix: true,
          createdAt: true,
          lastUsedAt: true,
          createdBy: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });
}

export async function ensureMcpServer(
  connectionId: string,
  userId: string,
) {
  const connection = await prisma.connection.findUnique({
    where: { id: connectionId },
    select: { id: true, type: true },
  });
  if (!connection) throw new Error("Connection not found.");
  if (connection.type !== "api") {
    throw new Error("MCP servers are only available for API connections.");
  }

  return prisma.mcpServer.upsert({
    where: { connectionId },
    create: {
      connectionId,
      createdById: userId,
      enabled: true,
    },
    update: {},
  });
}

export async function setMcpEnabled(
  connectionId: string,
  userId: string,
  enabled: boolean,
) {
  await ensureMcpServer(connectionId, userId);
  return prisma.mcpServer.update({
    where: { connectionId },
    data: { enabled },
  });
}

export async function setMcpTools(
  connectionId: string,
  userId: string,
  operationIds: string[],
) {
  const server = await ensureMcpServer(connectionId, userId);

  const uniqueIds = [...new Set(operationIds)];
  if (uniqueIds.length > 0) {
    const ops = await prisma.operation.findMany({
      where: {
        id: { in: uniqueIds },
        connectionId,
        source: { not: "sql" },
      },
      select: { id: true },
    });
    if (ops.length !== uniqueIds.length) {
      throw new Error("One or more operations do not belong to this connection.");
    }
  }

  await prisma.$transaction([
    prisma.mcpServerTool.deleteMany({ where: { mcpServerId: server.id } }),
    ...(uniqueIds.length
      ? [
          prisma.mcpServerTool.createMany({
            data: uniqueIds.map((operationId) => ({
              mcpServerId: server.id,
              operationId,
            })),
          }),
        ]
      : []),
  ]);

  return getMcpServerForConnection(connectionId);
}

export async function createMcpAccessToken(
  connectionId: string,
  userId: string,
  name: string,
) {
  const server = await ensureMcpServer(connectionId, userId);
  const minted = mintMcpToken();
  const label = name.trim() || "MCP client";

  const token = await prisma.mcpAccessToken.create({
    data: {
      mcpServerId: server.id,
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
  connectionId: string,
) {
  const token = await prisma.mcpAccessToken.findUnique({
    where: { id: tokenId },
    include: { mcpServer: { select: { connectionId: true } } },
  });
  if (!token || token.mcpServer.connectionId !== connectionId) {
    throw new Error("Token not found.");
  }
  await prisma.mcpAccessToken.update({
    where: { id: tokenId },
    data: { revokedAt: new Date() },
  });
}

export type McpToolDefinition = {
  operationId: string;
  name: string;
  description: string;
  method: string;
  path: string;
  inputSchema: ReturnType<typeof buildToolInputSchema>;
};

export async function listEnabledMcpTools(
  connectionId: string,
): Promise<McpToolDefinition[]> {
  const server = await prisma.mcpServer.findUnique({
    where: { connectionId },
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
            },
          },
        },
      },
    },
  });

  if (!server?.enabled) return [];

  const operations = server.tools
    .map((t) => t.operation)
    .filter((op) => !op.deprecated);

  const names = uniqueToolNames(operations);

  return operations.map((op) => {
    const params = (op.params as unknown as ParameterDescriptor[]) ?? [];
    return {
      operationId: op.id,
      name: names.get(op.id)!,
      description: toolDescription(op),
      method: op.method,
      path: op.path,
      inputSchema: buildToolInputSchema(params, op.requestSchema),
    };
  });
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

  if (!link || link.operation.connectionId !== auth.connectionId) {
    return {
      ok: false,
      text: "This tool is not enabled on this MCP server.",
    };
  }

  const allowed = await canCallOperation(
    auth.user,
    auth.connectionId,
    operationId,
  );
  if (!allowed) {
    await logDeniedApiCall({
      userId: auth.userId,
      connectionId: auth.connectionId,
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
