/**
 * Smoke test for hosted MCP: enable server, select tools, mint token, invoke.
 * Usage: npx tsx --conditions react-server scripts/smoke-mcp.ts
 */
import { prisma } from "../src/server/db";
import { DEMO_CONNECTION_NAME } from "../src/server/demo/access";
import { ensureDefaultRoles } from "../src/server/auth/roles";
import { hashPassword } from "../src/server/auth/password";
import {
  createMcpAccessToken,
  invokeMcpTool,
  listEnabledMcpTools,
  setMcpEnabled,
  setMcpTools,
  verifyMcpBearer,
} from "../src/server/mcp/service";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message);
}

async function main() {
  await ensureDefaultRoles();

  const connection = await prisma.connection.findFirst({
    where: { name: DEMO_CONNECTION_NAME },
    include: {
      operations: {
        where: { method: "GET", deprecated: false },
        take: 3,
        orderBy: { sortOrder: "asc" },
        select: { id: true, operationKey: true, method: true, path: true },
      },
    },
  });
  assert(connection, "demo connection missing — run npm run db:seed");
  assert(connection.operations.length > 0, "demo has no GET operations");

  const adminRole = await prisma.role.findUnique({ where: { key: "admin" } });
  assert(adminRole, "admin role");

  const stamp = Date.now();
  const user = await prisma.user.create({
    data: {
      email: `smoke-mcp-${stamp}@example.com`,
      name: "Smoke MCP",
      passwordHash: await hashPassword("smoke-mcp-password"),
      roleId: adminRole.id,
      emailVerifiedAt: new Date(),
    },
  });

  try {
    await setMcpEnabled(connection.id, user.id, true);
    await setMcpTools(
      connection.id,
      user.id,
      connection.operations.map((op) => op.id),
    );

    const tools = await listEnabledMcpTools(connection.id);
    assert(tools.length === connection.operations.length, "tool count");
    console.log(
      `tools: ${tools.map((t) => t.name).join(", ")}`,
    );

    const minted = await createMcpAccessToken(
      connection.id,
      user.id,
      "smoke",
    );
    assert(minted.rawToken.startsWith("seeit_mcp_"), "token prefix");

    const auth = await verifyMcpBearer(connection.id, minted.rawToken);
    assert(auth, "verify bearer");
    assert(auth.userId === user.id, "token owner");

    const bad = await verifyMcpBearer(connection.id, "seeit_mcp_invalid");
    assert(!bad, "reject bad token");

    const first = connection.operations[0]!;
    const result = await invokeMcpTool({
      auth,
      operationId: first.id,
      args: {},
    });
    // Without a running Next server the demo mock at /api/demo is unreachable;
    // still prove ACL + gateway wiring completed (not a tool/config error).
    if (!result.ok) {
      const parsed = JSON.parse(result.text) as {
        error?: { kind?: string };
      };
      assert(
        parsed.error?.kind === "network" || parsed.error?.kind === "timeout",
        `invoke ${first.operationKey}: ${result.text}`,
      );
      console.log(
        `invoked ${first.operationKey} reached gateway (${parsed.error?.kind})`,
      );
    } else {
      console.log(
        `invoked ${first.operationKey} ok (${result.text.length} chars)`,
      );
    }

    const base = process.env.SMOKE_BASE_URL?.trim();
    if (base) {
      const url = `${base.replace(/\/$/, "")}/api/mcp/${connection.id}`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          authorization: `Bearer ${minted.rawToken}`,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-03-26",
            capabilities: {},
            clientInfo: { name: "smoke-mcp", version: "0.0.1" },
          },
        }),
      });
      console.log(`HTTP initialize → ${res.status}`);
      const body = await res.text();
      assert(res.ok || res.status === 200, `HTTP initialize failed: ${body.slice(0, 400)}`);
      console.log(`HTTP body preview: ${body.slice(0, 200)}`);
    } else {
      console.log("skip HTTP (set SMOKE_BASE_URL to hit the route)");
    }

    console.log("smoke-mcp: ok");
  } finally {
    await prisma.mcpServer.deleteMany({ where: { connectionId: connection.id } });
    await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
