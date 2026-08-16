import { notFound } from "next/navigation";
import { requireSection } from "@/server/auth/permissions";
import {
  getMcpServerById,
  listApiOperationsForPicker,
} from "@/server/mcp/service";
import { PageBody, PageHeader } from "@/components/layout/PageHeader";
import { McpServerEditor } from "@/components/mcp/McpServerEditor";

export const dynamic = "force-dynamic";

export default async function McpDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ connection?: string }>;
}) {
  await requireSection("connections");
  const { id } = await params;
  const { connection: focusConnection } = await searchParams;

  const [server, operations] = await Promise.all([
    getMcpServerById(id),
    listApiOperationsForPicker(),
  ]);
  if (!server) notFound();

  return (
    <>
      <PageHeader
        title={server.name}
        description={`Hosted at /api/mcp/${server.slug}`}
        crumbs={[
          { label: "MCP", href: "/mcp" },
          { label: server.name },
        ]}
      />
      <PageBody>
        <McpServerEditor
          server={{
            id: server.id,
            name: server.name,
            slug: server.slug,
            enabled: server.enabled,
            isSample: server.isSample,
          }}
          selectedOperationIds={server.tools.map((t) => t.operationId)}
          operations={operations.map((op) => ({
            id: op.id,
            operationKey: op.operationKey,
            method: op.method,
            path: op.path,
            summary: op.summary,
            tags: op.tags,
            connectionId: op.connectionId,
            connectionName: op.connection.name,
            connectionSlug: op.connection.slug,
          }))}
          tokens={server.tokens.map((token) => ({
            id: token.id,
            name: token.name,
            tokenPrefix: token.tokenPrefix,
            createdAt: token.createdAt.toISOString(),
            lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
          }))}
          focusConnectionId={focusConnection ?? null}
        />
      </PageBody>
    </>
  );
}
