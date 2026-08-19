import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/server/db";
import {
  createConnectionFromSpec,
  saveCredentials,
} from "@/server/connections/service";
import { DEMO_CREDENTIALS } from "./data";
import {
  DEMO_CONNECTION_NAME,
  DEMO_DASHBOARD_SLUG,
  demoConnectionNameWhere,
} from "@/server/demo/access";
import { instantiateTemplate } from "@/server/sites/service";
import type { Prisma } from "@prisma/client";
import {
  ensureSampleMcpServer,
  SAMPLE_MCP_SLUGS,
} from "@/server/mcp/sample";

export { DEMO_CONNECTION_NAME, DEMO_DASHBOARD_SLUG };

/**
 * The bundled demo points at Argent's own mock sample API, so everything works
 * with no external service. Override with DEMO_API_BASE_URL to aim the same
 * spec at a real server.
 */
function demoBaseUrl(): string {
  return (
    process.env.DEMO_API_BASE_URL ??
    `${process.env.APP_URL ?? "http://localhost:3000"}/api/demo`
  );
}

async function readFixture(): Promise<string> {
  return readFile(path.join(process.cwd(), "fixtures", "demo.yaml"), "utf8");
}

export interface SeedResult {
  connectionId: string;
  dashboardSlug: string;
  operationCount: number;
  objectCount: number;
  alreadyExisted: boolean;
}

export async function isDemoInstalled(): Promise<boolean> {
  const existing = await prisma.connection.findFirst({
    where: demoConnectionNameWhere(),
    select: { id: true },
  });
  return existing !== null;
}

/** Removes the demo connection and the sample MCP server. */
export async function removeDemo(): Promise<void> {
  const connection = await prisma.connection.findFirst({
    where: demoConnectionNameWhere(),
    select: { id: true },
  });
  if (!connection) return;

  await prisma.mcpServer.deleteMany({
    where: { slug: { in: [...SAMPLE_MCP_SLUGS] } },
  });
  await prisma.dashboard.deleteMany({ where: { connectionId: connection.id } });
  await prisma.connection.delete({ where: { id: connection.id } });
}

/**
 * Installs the bundled sample API: the spec, saved credentials, ready-made
 * objects, a Campaign hub site, and the sample MCP server (slug `sample`).
 *
 * If the demo is already installed, objects and the site layout are
 * rebuilt from the latest template (connection + credentials stay).
 */
export async function seedDemo(createdById?: string): Promise<SeedResult> {
  const existing = await prisma.connection.findFirst({
    where: demoConnectionNameWhere(),
    include: { _count: { select: { operations: true, dataObjects: true } } },
  });

  let connectionId: string;
  let operationCount: number;
  let objectCount: number;
  let alreadyExisted: boolean;

  const aboutMarkdown =
    "This connection points at a mock sample API bundled with Argent. " +
    "The figures are generated, but everything else — the import, the " +
    "gateway, the objects and the site — is the real thing. Sign in " +
    "details are already saved, so the Try it panel works straight away.";

  if (existing) {
    const rawSpec = await readFixture();
    let slug = existing.slug;
    if (slug.includes("adlogic")) {
      const taken = await prisma.connection.findUnique({
        where: { slug: "sample-api" },
        select: { id: true },
      });
      if (!taken || taken.id === existing.id) slug = "sample-api";
    }
    await prisma.connection.update({
      where: { id: existing.id },
      data: {
        name: DEMO_CONNECTION_NAME,
        slug,
        specTitle: "Sample API",
        rawSpec,
        description:
          "A complete, working example. It talks to a mock sample API built " +
          "into Argent, so nothing leaves this machine.",
      },
    });
    await prisma.docPage.updateMany({
      where: {
        connectionId: existing.id,
        scope: "overview",
        title: "About this demo",
      },
      data: { bodyMarkdown: aboutMarkdown },
    });
    const rebuilt = await rebuildDemoSite(existing.id);
    connectionId = existing.id;
    operationCount = rebuilt.operationCount;
    objectCount = rebuilt.objectCount;
    alreadyExisted = true;
  } else {
    const rawSpec = await readFixture();

    const { connection } = await createConnectionFromSpec({
      name: DEMO_CONNECTION_NAME,
      rawSpec,
      specFormat: "yaml",
      baseUrl: demoBaseUrl(),
      readOnly: false,
    });

    await saveCredentials(connection.id, [
      { name: "apiu", in: "query", value: DEMO_CREDENTIALS.apiu },
      { name: "apik", in: "query", value: DEMO_CREDENTIALS.apik },
    ]);

    await prisma.connection.update({
      where: { id: connection.id },
      data: {
        description:
          "A complete, working example. It talks to a mock sample API built " +
          "into Argent, so nothing leaves this machine.",
        variables: { defaultTimezone: "UTC" } as Prisma.InputJsonValue,
      },
    });

    const rebuilt = await rebuildDemoSite(connection.id);

    await prisma.docPage.create({
      data: {
        connectionId: connection.id,
        scope: "overview",
        targetKey: "",
        title: "About this demo",
        bodyMarkdown: aboutMarkdown,
      },
    });

    connectionId = connection.id;
    operationCount = rebuilt.operationCount;
    objectCount = rebuilt.objectCount;
    alreadyExisted = false;
  }

  const ownerId =
    createdById ??
    (
      await prisma.user.findFirst({
        where: { role: { key: "admin" }, active: true },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      })
    )?.id;

  if (ownerId) {
    await ensureSampleMcpServer(ownerId);
  }

  return {
    connectionId,
    dashboardSlug: DEMO_DASHBOARD_SLUG,
    operationCount,
    objectCount,
    alreadyExisted,
  };
}

/** Replace demo objects + Campaign hub site from the template. */
async function rebuildDemoSite(
  connectionId: string,
): Promise<{ operationCount: number; objectCount: number }> {
  await prisma.dashboard.deleteMany({ where: { connectionId } });
  await prisma.dataObject.deleteMany({ where: { connectionId } });

  await instantiateTemplate("campaign-hub", {
    name: "Campaign performance",
    connectionId,
    slug: DEMO_DASHBOARD_SLUG,
    isDefault: true,
    description:
      "Overview, campaigns and groups — headline numbers, charts, tables and a linked edit form.",
  });

  const [operationCount, objectCount] = await Promise.all([
    prisma.operation.count({ where: { connectionId } }),
    prisma.dataObject.count({ where: { connectionId } }),
  ]);

  return { operationCount, objectCount };
}
