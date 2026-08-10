import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, Boxes, Telescope } from "lucide-react";
import { prisma } from "@/server/db";
import {
  connectionHeaders,
  credentialCandidatesFor,
  getConnection,
} from "@/server/connections/service";
import { getDbCatalog, listSqlOperations } from "@/server/database/service";
import { DEMO_CONNECTION_NAME } from "@/server/demo/seed";
import { PageBody, PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { ConnectionSettings } from "@/components/connections/ConnectionSettings";
import { DatabaseConnectionPanel } from "@/components/connections/DatabaseConnectionPanel";
import { McpServerPanel } from "@/components/connections/McpServerPanel";
import { RequestLogTable } from "@/components/connections/RequestLogTable";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/primitives";
import type { DbConfig } from "@/server/database/types";
import { isAdmin, requireSection } from "@/server/auth/permissions";
import { getMcpServerForConnection } from "@/server/mcp/service";

export const dynamic = "force-dynamic";

export default async function ConnectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireSection("connections");
  const { id } = await params;
  const connection = await getConnection(id);
  if (!connection) notFound();

  if (connection.type === "database") {
    const [catalog, queries, logs] = await Promise.all([
      getDbCatalog(id),
      listSqlOperations(id),
      prisma.requestLog.findMany({
        where: { connectionId: id },
        orderBy: { createdAt: "desc" },
        take: 25,
        include: { operation: { select: { summary: true, path: true } } },
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

    return (
      <>
        <PageHeader
          title={connection.name}
          description={connection.baseUrl}
          crumbs={[
            { label: "Connections", href: "/connections" },
            { label: connection.name },
          ]}
          actions={
            <div className="flex flex-wrap gap-2">
              <Link href={`/docs/${connection.id}`}>
                <Button variant="secondary">
                  <BookOpen />
                  <span className="hidden sm:inline">Help & Docs</span>
                  <span className="sm:hidden">Docs</span>
                </Button>
              </Link>
              <Link href={`/objects/new?connection=${connection.id}`}>
                <Button variant="secondary">
                  <Boxes />
                  <span className="hidden sm:inline">Build an object</span>
                  <span className="sm:hidden">Build</span>
                </Button>
              </Link>
            </div>
          }
        />

        <PageBody className="max-w-6xl space-y-5">
          <DatabaseConnectionPanel
            connection={{
              id: connection.id,
              name: connection.name,
              baseUrl: connection.baseUrl,
              readOnly: connection.readOnly,
              status: connection.status,
              lastError: connection.lastError,
              operationCount: connection._count.operations,
              objectCount: connection._count.dataObjects,
              config,
              hasPassword: Boolean(
                connection.authProfile?.secretKeys?.includes("password"),
              ),
            }}
            schemas={catalog.schemas}
            refreshedAt={catalog.refreshedAt?.toISOString() ?? null}
            queries={queries.map((query) => ({
              id: query.id,
              name: query.summary ?? query.operationKey,
              sqlTemplate: query.sqlTemplate ?? "",
              description: query.description,
            }))}
          />

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Recent activity</CardTitle>
                <p className="text-xs text-ink-soft">
                  The last 25 queries seeIt ran against this database.
                </p>
              </div>
            </CardHeader>
            <CardBody className="p-0">
              <RequestLogTable
                logs={logs.map((log) => ({
                  id: log.id,
                  method: log.method,
                  url: log.url,
                  status: log.status,
                  ok: log.ok,
                  durationMs: log.durationMs,
                  error: log.error,
                  origin: log.origin,
                  createdAt: log.createdAt.toISOString(),
                  label: log.operation?.summary ?? log.operation?.path ?? null,
                }))}
              />
            </CardBody>
          </Card>
        </PageBody>
      </>
    );
  }

  const [candidates, headers, logs, mcpServer, operations] = await Promise.all([
    credentialCandidatesFor(id),
    connectionHeaders(id),
    prisma.requestLog.findMany({
      where: { connectionId: id },
      orderBy: { createdAt: "desc" },
      take: 25,
      include: { operation: { select: { summary: true, path: true } } },
    }),
    getMcpServerForConnection(id),
    prisma.operation.findMany({
      where: { connectionId: id, source: { not: "sql" } },
      orderBy: [{ sortOrder: "asc" }, { path: "asc" }],
      select: {
        id: true,
        operationKey: true,
        method: true,
        path: true,
        summary: true,
        tags: true,
      },
    }),
  ]);

  const savedKeys = new Set(connection.authProfile?.secretKeys ?? []);
  const configured = new Set(
    ((connection.authProfile?.injection as { name: string }[]) ?? []).map(
      (rule) => rule.name,
    ),
  );

  const credentialFields = candidates.map((candidate) => ({
    name: candidate.name,
    in: candidate.in === "header" ? ("header" as const) : ("query" as const),
    description: candidate.description,
    occurrences: candidate.occurrences,
    hasValue: savedKeys.has(candidate.name),
    enabled: configured.has(candidate.name) || savedKeys.has(candidate.name),
  }));

  return (
    <>
      <PageHeader
        title={connection.name}
        description={connection.specTitle ?? undefined}
        crumbs={[
          { label: "Connections", href: "/connections" },
          { label: connection.name },
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href={`/docs/${connection.id}`}>
              <Button variant="ghost">
                <BookOpen /> Docs
              </Button>
            </Link>
            <Link href={`/explorer/${connection.id}`}>
              <Button variant="secondary">
                <Telescope />
                <span className="hidden sm:inline">Explore endpoints</span>
                <span className="sm:hidden">Explore</span>
              </Button>
            </Link>
          </div>
        }
      />

      <PageBody className="max-w-4xl space-y-5">
        <ConnectionSettings
          connection={{
            id: connection.id,
            name: connection.name,
            baseUrl: connection.baseUrl,
            readOnly: connection.readOnly,
            status: connection.status,
            lastError: connection.lastError,
            servers:
              (connection.servers as { url: string; description?: string }[]) ??
              [],
            operationCount: connection._count.operations,
            objectCount: connection._count.dataObjects,
            authKind: connection.authProfile?.kind ?? "none",
            hasBearerToken: savedKeys.has("token"),
            hasBasicUser: savedKeys.has("username"),
            isDemo: connection.name === DEMO_CONNECTION_NAME,
          }}
          credentialFields={credentialFields}
          headers={headers}
          canRemoveDemo={isAdmin(user)}
        />

        <McpServerPanel
          connectionId={connection.id}
          connectionName={connection.name}
          enabled={mcpServer?.enabled ?? false}
          selectedOperationIds={
            mcpServer?.tools.map((tool) => tool.operationId) ?? []
          }
          operations={operations}
          tokens={
            mcpServer?.tokens.map((token) => ({
              id: token.id,
              name: token.name,
              tokenPrefix: token.tokenPrefix,
              createdAt: token.createdAt.toISOString(),
              lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
            })) ?? []
          }
        />

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Recent activity</CardTitle>
              <p className="text-xs text-ink-soft">
                The last 25 requests seeIt made to this API.
              </p>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            <RequestLogTable
              logs={logs.map((log) => ({
                id: log.id,
                method: log.method,
                url: log.url,
                status: log.status,
                ok: log.ok,
                durationMs: log.durationMs,
                error: log.error,
                origin: log.origin,
                createdAt: log.createdAt.toISOString(),
                label: log.operation?.summary ?? log.operation?.path ?? null,
              }))}
            />
          </CardBody>
        </Card>
      </PageBody>
    </>
  );
}
