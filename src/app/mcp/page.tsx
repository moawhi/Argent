import Link from "next/link";
import { Cable, Plus } from "lucide-react";
import { requireSection } from "@/server/auth/permissions";
import { listMcpServers } from "@/server/mcp/service";
import { PageBody, PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Badge,
  Card,
  EmptyState,
} from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

export default async function McpListPage({
  searchParams,
}: {
  searchParams: Promise<{ connection?: string }>;
}) {
  await requireSection("connections");
  const { connection: focusConnection } = await searchParams;
  const servers = await listMcpServers();

  return (
    <>
      <PageHeader
        title="MCP servers"
        description="Named tool packs for Cursor and Claude. Each server can mix endpoints from multiple API connections."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/docs/guides/mcp">
              <Button variant="secondary">What is MCP?</Button>
            </Link>
            <Link
              href={
                focusConnection
                  ? `/mcp/new?connection=${focusConnection}`
                  : "/mcp/new"
              }
            >
              <Button>
                <Plus />
                <span className="hidden sm:inline">New MCP server</span>
                <span className="sm:hidden">New</span>
              </Button>
            </Link>
          </div>
        }
      />

      <PageBody>
        {servers.length === 0 ? (
          <EmptyState
            icon={<Cable className="size-5" />}
            title="No MCP servers yet"
            description="Create a server, pick tools from your API sets, and mint a token for your agent client."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Link href="/mcp/new">
                  <Button>
                    <Plus /> Create MCP server
                  </Button>
                </Link>
                <Link href="/docs/guides/setup">
                  <Button variant="secondary">How MCP works</Button>
                </Link>
              </div>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {servers.map((server) => (
              <Link
                key={server.id}
                href={`/mcp/${server.id}`}
                className="min-w-0"
              >
                <Card className="flex h-full min-w-0 flex-col p-4 transition-shadow hover:shadow-md">
                  <div className="mb-3 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {server.name}
                      </p>
                      <p className="break-all font-mono text-[11px] text-ink-faint sm:truncate sm:break-normal">
                        /api/mcp/{server.slug}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-1">
                      <Badge tone={server.enabled ? "positive" : "neutral"}>
                        {server.enabled ? "On" : "Off"}
                      </Badge>
                      {server.isSample ? (
                        <Badge tone="brand">Sample</Badge>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-auto text-xs text-ink-soft">
                    {server._count.tools} tool
                    {server._count.tools === 1 ? "" : "s"} ·{" "}
                    {server._count.tokens} token
                    {server._count.tokens === 1 ? "" : "s"}
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </PageBody>
    </>
  );
}
