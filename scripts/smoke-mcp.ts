/**
 * Smoke test for multi–API-set MCP: seed sample, mint token, invoke, HTTP.
 * Usage: npx tsx --conditions react-server scripts/smoke-mcp.ts
 * Optional: SMOKE_BASE_URL=http://localhost:3000
 */
import { prisma } from "../src/server/db";
import { ensureDefaultRoles } from "../src/server/auth/roles";
import { hashPassword } from "../src/server/auth/password";
import { seedDemo } from "../src/server/demo/seed";
import {
  SAMPLE_MCP_SLUG,
  seedSampleMcpWithToken,
} from "../src/server/mcp/sample";
import {
  invokeMcpTool,
  listEnabledMcpToolsBySlug,
  verifyMcpBearer,
} from "../src/server/mcp/service";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message);
}

async function main() {
  await ensureDefaultRoles();

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
    await seedDemo(user.id);
    const sample = await seedSampleMcpWithToken(user.id);
    assert(sample.slug === SAMPLE_MCP_SLUG, "sample slug");

    const listed = await listEnabledMcpToolsBySlug(SAMPLE_MCP_SLUG);
    assert(listed && listed.tools.length > 0, "sample tools");
    console.log(
      `tools: ${listed!.tools.map((t) => t.name).join(", ")}`,
    );

    const auth = await verifyMcpBearer(SAMPLE_MCP_SLUG, sample.rawToken);
    assert(auth, "verify bearer");
    assert(auth.userId === user.id, "token owner");

    const bad = await verifyMcpBearer(SAMPLE_MCP_SLUG, "seeit_mcp_invalid");
    assert(!bad, "reject bad token");

    const first =
      listed!.tools.find((t) => t.name === "listAccounts") ??
      listed!.tools.find((t) => t.name.startsWith("list")) ??
      listed!.tools[0]!;
    const result = await invokeMcpTool({
      auth,
      operationId: first.operationId,
      args: {},
    });

    if (!result.ok) {
      const parsed = JSON.parse(result.text) as {
        error?: { kind?: string };
      };
      assert(
        parsed.error?.kind === "network" ||
          parsed.error?.kind === "timeout" ||
          parsed.error?.kind === "missingParam",
        `invoke ${first.name}: ${result.text}`,
      );
      console.log(
        `invoked ${first.name} reached gateway (${parsed.error?.kind})`,
      );
    } else {
      console.log(`invoked ${first.name} ok (${result.text.length} chars)`);
    }

    const base = process.env.SMOKE_BASE_URL?.trim();
    if (base) {
      const url = `${base.replace(/\/$/, "")}/api/mcp/${SAMPLE_MCP_SLUG}`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          authorization: `Bearer ${sample.rawToken}`,
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
      assert(
        res.ok || res.status === 200,
        `HTTP initialize failed: ${body.slice(0, 400)}`,
      );
      console.log(`HTTP body preview: ${body.slice(0, 200)}`);
    } else {
      console.log("skip HTTP (set SMOKE_BASE_URL to hit the route)");
    }

    console.log("smoke-mcp: ok");
  } finally {
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
