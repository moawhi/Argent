import type { AuthInfo } from "@modelcontextprotocol/server";
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import type { NextRequest } from "next/server";
import { APP_NAME, mcpServerInfoName } from "@/lib/brand";
import {
  invokeMcpTool,
  listEnabledMcpToolsBySlug,
  verifyMcpBearer,
  type McpSessionAuth,
} from "@/server/mcp/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ slug: string }> };

async function buildHandler(slug: string, auth: McpSessionAuth) {
  const listed = await listEnabledMcpToolsBySlug(slug);
  if (!listed) return null;

  return createMcpHandler(
    (server) => {
      for (const tool of listed.tools) {
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
        name: mcpServerInfoName(slug),
        version: "1.0.0",
      },
      instructions: `Hosted MCP tools for “${listed.serverName}”. Tools may come from multiple API connections; credentials stay on the ${APP_NAME} gateway.`,
    },
  );
}

async function handle(req: NextRequest, context: RouteContext) {
  const { slug } = await context.params;

  const verifyToken = async (
    _req: Request,
    bearerToken?: string,
  ): Promise<AuthInfo | undefined> => {
    const auth = await verifyMcpBearer(slug, bearerToken);
    if (!auth) return undefined;
    return {
      token: bearerToken!,
      scopes: ["mcp:tools"],
      clientId: auth.userId,
      extra: { auth },
    };
  };

  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const auth = await verifyMcpBearer(slug, bearer?.trim());
  if (!auth) {
    return new Response(
      JSON.stringify({
        error: "unauthorized",
        message: `Provide a valid ${APP_NAME} MCP bearer token.`,
      }),
      {
        status: 401,
        headers: {
          "content-type": "application/json",
          "www-authenticate": 'Bearer realm="argent-mcp", error="invalid_token"',
        },
      },
    );
  }

  const mcp = await buildHandler(slug, auth);
  if (!mcp) {
    return new Response(
      JSON.stringify({
        error: "not_found",
        message: "No enabled MCP server found for that slug.",
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
