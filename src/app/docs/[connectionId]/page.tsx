import Link from "next/link";
import { notFound } from "next/navigation";
import { Database, Telescope } from "lucide-react";
import { prisma } from "@/server/db";
import { getConnection } from "@/server/connections/service";
import { credentialNamesFor } from "@/server/operations/queries";
import { getDbCatalog } from "@/server/database/service";
import { buildCurl, buildOperationDoc, groupByTag } from "@/lib/docs/generate";
import { buildDatabaseDocs } from "@/lib/docs/database";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { DocsShell } from "@/components/docs/DocsShell";
import { DatabaseDocsShell } from "@/components/docs/DatabaseDocsShell";
import { canAccessConnection } from "@/server/auth/api-grants";
import { isAdmin, requireSection } from "@/server/auth/permissions";
import { isDemoConnectionName } from "@/server/demo/access";
import { HideDemoButton } from "@/components/demo/HideDemoButton";
import type { DbConfig } from "@/server/database/types";
import type { DbSchema } from "@/lib/database/schema-types";

export const dynamic = "force-dynamic";

export default async function DocsPage({
  params,
  searchParams,
}: {
  params: Promise<{ connectionId: string }>;
  searchParams: Promise<{ tag?: string }>;
}) {
  const user = await requireSection("docs");
  const { connectionId } = await params;
  const { tag } = await searchParams;

  const connection = await getConnection(connectionId);
  if (!connection) notFound();
  if (!(await canAccessConnection(user, connectionId))) notFound();

  const demo = isDemoConnectionName(connection.name);
  const hideControl =
    demo && !isAdmin(user) ? <HideDemoButton label="Hide" /> : null;

  const notes = await prisma.docPage.findMany({ where: { connectionId } });
  const noteByKey = new Map(
    notes.map((note) => [`${note.scope}:${note.targetKey}`, note.bodyMarkdown]),
  );

  if (connection.type === "database") {
    const [catalog, operations] = await Promise.all([
      getDbCatalog(connectionId),
      prisma.operation.findMany({
        where: { connectionId, source: "sql" },
        orderBy: { sortOrder: "asc" },
      }),
    ]);

    const config = (connection.dbConfig as unknown as DbConfig) ?? {
      engine: "postgres" as const,
      host: "localhost",
      port: 5432,
      database: "",
      user: "",
      ssl: false,
    };

    const schemas = (catalog?.schemas as DbSchema[] | undefined) ?? [];
    const model = buildDatabaseDocs({
      engine: config.engine,
      baseUrl: connection.baseUrl,
      schemas,
      operations,
      notes: noteByKey,
    });

    const queryNotes: Record<string, string | null> = {};
    for (const note of notes) {
      if (note.scope === "operation") {
        queryNotes[note.targetKey] = note.bodyMarkdown;
      }
    }

    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <PageHeader
          dense
          title={connection.name}
          description={`${model.engineLabel} · ${model.stats.tables} tables · ${model.stats.relations} relations`}
          crumbs={[
            { label: "Help & Docs", href: "/docs" },
            { label: connection.name },
          ]}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {hideControl}
              <Link href={`/connections/${connectionId}`}>
                <Button size="sm" variant="secondary">
                  <Database />
                  <span className="hidden sm:inline">Open connection</span>
                  <span className="sm:hidden">Open</span>
                </Button>
              </Link>
            </div>
          }
        />

        <DatabaseDocsShell
          connectionId={connectionId}
          connectionName={connection.name}
          description={connection.description}
          overviewNote={noteByKey.get("overview:") ?? null}
          model={model}
          queryNotes={queryNotes}
        />
      </div>
    );
  }

  const [operations, credentialNames] = await Promise.all([
    prisma.operation.findMany({
      where: { connectionId },
      orderBy: { sortOrder: "asc" },
    }),
    credentialNamesFor(connectionId),
  ]);

  const docs = operations.map((operation) => {
    const doc = buildOperationDoc(operation, { credentialNames });
    return {
      doc,
      curl: buildCurl(doc, connection.baseUrl),
      note: noteByKey.get(`operation:${operation.operationKey}`) ?? null,
    };
  });

  const groups = groupByTag(docs.map((entry) => entry.doc)).map((group) => ({
    tag: group.tag,
    note: noteByKey.get(`tag:${group.tag}`) ?? null,
    entries: group.operations.map(
      (operation) => docs.find((entry) => entry.doc.id === operation.id)!,
    ),
  }));

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        dense
        title={connection.name}
        description={
          connection.specVersion
            ? `Version ${connection.specVersion} · ${operations.length} endpoints`
            : `${operations.length} endpoints`
        }
        crumbs={[
          { label: "Help & Docs", href: "/docs" },
          { label: connection.name },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {hideControl}
            <Link href={`/explorer/${connectionId}`}>
              <Button size="sm" variant="secondary">
                <Telescope />
                <span className="hidden sm:inline">Try these endpoints</span>
                <span className="sm:hidden">Try it</span>
              </Button>
            </Link>
          </div>
        }
      />

      <DocsShell
        connectionId={connectionId}
        connectionName={connection.name}
        baseUrl={connection.baseUrl}
        overviewNote={noteByKey.get("overview:") ?? null}
        description={connection.description}
        groups={groups}
        initialTag={tag}
      />
    </div>
  );
}
