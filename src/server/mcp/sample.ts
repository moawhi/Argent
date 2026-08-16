import "server-only";

import { prisma } from "@/server/db";
import { demoConnectionNameWhere } from "@/server/demo/access";
import { createMcpAccessToken } from "@/server/mcp/service";

export const SAMPLE_MCP_SLUG = "sample";
export const SAMPLE_MCP_NAME = "Sample MCP";
/** Previous slug; migrated on seed so existing tokens keep working after rename. */
export const LEGACY_SAMPLE_MCP_SLUGS = ["adlogic-demo"] as const;
export const SAMPLE_MCP_SLUGS: readonly string[] = [
  SAMPLE_MCP_SLUG,
  ...LEGACY_SAMPLE_MCP_SLUGS,
];

/** Curated safe GET tools from the bundled sample API. */
export const SAMPLE_MCP_OPERATION_KEYS = [
  "listAccounts",
  "getAccount",
  "listAccountCampaigns",
  "listCampaigns",
  "getCampaign",
  "getStatsSummary",
  "getDailyStats",
  "getCampaignStats",
] as const;

async function findSampleMcpServer() {
  const current = await prisma.mcpServer.findUnique({
    where: { slug: SAMPLE_MCP_SLUG },
  });
  if (current) return current;

  return prisma.mcpServer.findFirst({
    where: {
      OR: [
        { isSample: true },
        { slug: { in: [...LEGACY_SAMPLE_MCP_SLUGS] } },
      ],
    },
  });
}

/**
 * Upsert the sample MCP server on the bundled demo connection.
 * Idempotent: refreshes tools; does not mint tokens.
 * Renames a legacy `adlogic-demo` server in place so tokens survive.
 */
export async function ensureSampleMcpServer(createdById: string): Promise<{
  id: string;
  slug: string;
  name: string;
  toolCount: number;
}> {
  const connection = await prisma.connection.findFirst({
    where: demoConnectionNameWhere(),
    select: { id: true },
  });
  if (!connection) {
    throw new Error("Sample API connection is not installed.");
  }

  const operations = await prisma.operation.findMany({
    where: {
      connectionId: connection.id,
      operationKey: { in: [...SAMPLE_MCP_OPERATION_KEYS] },
      method: "GET",
    },
    select: { id: true, operationKey: true },
  });

  const existing = await findSampleMcpServer();
  const server = existing
    ? await prisma.mcpServer.update({
        where: { id: existing.id },
        data: {
          name: SAMPLE_MCP_NAME,
          slug: SAMPLE_MCP_SLUG,
          enabled: true,
          isSample: true,
        },
      })
    : await prisma.mcpServer.create({
        data: {
          name: SAMPLE_MCP_NAME,
          slug: SAMPLE_MCP_SLUG,
          enabled: true,
          isSample: true,
          createdById,
        },
      });

  await prisma.mcpServer.deleteMany({
    where: {
      slug: { in: [...LEGACY_SAMPLE_MCP_SLUGS] },
      id: { not: server.id },
    },
  });

  await prisma.$transaction([
    prisma.mcpServerTool.deleteMany({ where: { mcpServerId: server.id } }),
    ...(operations.length
      ? [
          prisma.mcpServerTool.createMany({
            data: operations.map((op) => ({
              mcpServerId: server.id,
              operationId: op.id,
            })),
          }),
        ]
      : []),
  ]);

  return {
    id: server.id,
    slug: server.slug,
    name: server.name,
    toolCount: operations.length,
  };
}

/** Seed sample MCP and mint a one-time onboarding token. */
export async function seedSampleMcpWithToken(userId: string): Promise<{
  serverId: string;
  slug: string;
  name: string;
  toolCount: number;
  rawToken: string;
  tokenPrefix: string;
}> {
  const sample = await ensureSampleMcpServer(userId);
  const token = await createMcpAccessToken(
    sample.id,
    userId,
    "Onboarding sample",
  );
  return {
    serverId: sample.id,
    slug: sample.slug,
    name: sample.name,
    toolCount: sample.toolCount,
    rawToken: token.rawToken,
    tokenPrefix: token.tokenPrefix,
  };
}
