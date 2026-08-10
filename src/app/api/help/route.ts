import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { buildCurl, buildOperationDoc } from "@/lib/docs/generate";
import { buildSqlOperationDoc, buildTableDocs } from "@/lib/docs/database";
import { mapCatalogRelations, type DbSchema } from "@/lib/database/schema-types";
import type { DbConfig } from "@/server/database/types";

export const runtime = "nodejs";

/**
 * Backs the contextual help drawer. Returns the generated reference for one
 * operation/query, a tag list, or a database table from the catalog.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const connectionId = url.searchParams.get("connectionId");
  const operationKey = url.searchParams.get("operationKey");
  const tag = url.searchParams.get("tag");
  const table = url.searchParams.get("table");

  if (!connectionId) {
    return NextResponse.json(
      { error: "connectionId is required" },
      { status: 400 },
    );
  }

  const connection = await prisma.connection.findUnique({
    where: { id: connectionId },
    include: {
      authProfile: true,
      dbCatalog: true,
    },
  });

  if (!connection) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  const credentialNames = new Set(
    (
      (connection.authProfile?.injection as { in: string; name: string }[]) ??
      []
    ).map((rule) => `${rule.in}:${rule.name}`),
  );

  if (table && connection.type === "database") {
    const schemas = mapCatalogRelations(
      (connection.dbCatalog?.schemas as DbSchema[] | undefined) ?? [],
    );
    const docs = buildTableDocs(schemas);
    const doc = docs.find((entry) => entry.id === table);
    if (!doc) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    const note = await prisma.docPage.findUnique({
      where: {
        connectionId_scope_targetKey: {
          connectionId,
          scope: "operation",
          targetKey: table,
        },
      },
    });

    const config = connection.dbConfig as unknown as DbConfig | null;

    return NextResponse.json({
      kind: "table",
      connectionName: connection.name,
      engine: config?.engine ?? "postgres",
      baseUrl: connection.baseUrl,
      doc,
      note: note?.bodyMarkdown ?? null,
    });
  }

  if (operationKey) {
    const operation = await prisma.operation.findUnique({
      where: { connectionId_operationKey: { connectionId, operationKey } },
    });

    if (!operation) {
      return NextResponse.json({ error: "Endpoint not found" }, { status: 404 });
    }

    const note = await prisma.docPage.findUnique({
      where: {
        connectionId_scope_targetKey: {
          connectionId,
          scope: "operation",
          targetKey: operationKey,
        },
      },
    });

    if (operation.source === "sql" || connection.type === "database") {
      const doc = buildSqlOperationDoc(operation);
      return NextResponse.json({
        kind: "sql",
        connectionName: connection.name,
        baseUrl: connection.baseUrl,
        doc,
        note: note?.bodyMarkdown ?? null,
      });
    }

    const doc = buildOperationDoc(operation, { credentialNames });

    return NextResponse.json({
      kind: "operation",
      connectionName: connection.name,
      baseUrl: connection.baseUrl,
      doc,
      curl: buildCurl(doc, connection.baseUrl),
      note: note?.bodyMarkdown ?? null,
    });
  }

  if (tag) {
    const operations = await prisma.operation.findMany({
      where: { connectionId, tags: { has: tag } },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        operationKey: true,
        method: true,
        path: true,
        summary: true,
        source: true,
      },
    });

    return NextResponse.json({
      kind: "tag",
      connectionName: connection.name,
      tag,
      operations,
      connectionType: connection.type,
    });
  }

  return NextResponse.json(
    { error: "Provide operationKey, tag, or table" },
    { status: 400 },
  );
}
