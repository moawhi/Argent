import type { AuthInfo } from "@modelcontextprotocol/server";
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import type { NextRequest } from "next/server";
import {
  invokeMcpTool,
  listEnabledMcpTools,
  verifyMcpBearer,
  type McpSessionAuth,
} from "@/server/mcp/service";
import { prisma } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ connectionId: string }> };

async function buildHandler(connectionId: string, auth: McpSessionAuth) {
  const connection = await prisma.connection.findUnique({
    where: { id: connectionId },
    select: { id: true, name: true, type: true, slug: true },
  });

  if (!connection || connection.type !== "api") {
    return null;
  }

  const tools = await listEnabledMcpTools(connectionId);

  return createMcpHandler(
    (server) => {
      for (const tool of tools) {
        server.registerTool(
          tool.name,
          {
            title: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
          },
          async (args) => {
            const result = await invokeMcpTool({
              auth,
              operationId: tool.operationId,
              args: (args ?? {}) as Record<string, unknown>,
            });
            return {
              content: [{ type: "text" as const, text: result.text }],
              isError: !result.ok,
            };
          },
        );
      }
    },
    {
      serverInfo: {
        name: `seeit-${connection.slug}`,
        version: "1.0.0",
      },
      instructions: `Hosted MCP tools for the seeIt connection “${connection.name}”. Each tool maps to an API operation; credentials stay on the seeIt gateway.`,
    },
  );
}

async function handle(req: NextRequest, context: RouteContext) {
  const { connectionId } = await context.params;

  const verifyToken = async (
    _req: Request,
    bearerToken?: string,
  ): Promise<AuthInfo | undefined> => {
    const auth = await verifyMcpBearer(connectionId, bearerToken);
    if (!auth) return undefined;
    return {
      token: bearerToken!,
      scopes: ["mcp:tools"],
      clientId: auth.userId,
      extra: { auth },
    };
  };

  // Resolve auth first so we can build tools for this tenant.
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const auth = await verifyMcpBearer(connectionId, bearer?.trim());
  if (!auth) {
    return new Response(
      JSON.stringify({
        error: "unauthorized",
        message: "Provide a valid seeIt MCP bearer token.",
      }),
      {
        status: 401,
        headers: {
          "content-type": "application/json",
          "www-authenticate": 'Bearer realm="seeit-mcp", error="invalid_token"',
        },
      },
    );
  }

  const mcp = await buildHandler(connectionId, auth);
  if (!mcp) {
    return new Response(
      JSON.stringify({
        error: "not_found",
        message: "No API connection MCP server found.",
      }),
      { status: 404, headers: { "content-type": "application/json" } },
    );
  }

  const authed = withMcpAuth(mcp, verifyToken, {
    required: true,
    requiredScopes: ["mcp:tools"],
  });

  return authed(req);
}

export { handle as GET, handle as POST, handle as DELETE };
