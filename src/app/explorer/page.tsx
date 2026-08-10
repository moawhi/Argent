import Link from "next/link";
import { redirect } from "next/navigation";
import { Database, Plug, Plus, Route } from "lucide-react";
import { listConnections } from "@/server/connections/service";
import { filterAccessibleConnections } from "@/server/auth/api-grants";
import { PageBody, PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Badge,
  Card,
  EmptyState,
  StatusDot,
} from "@/components/ui/primitives";
import { formatRelativeTime } from "@/lib/utils";
import { requireSection } from "@/server/auth/permissions";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  healthy: "Working",
  failing: "Not responding",
  untested: "Not tested yet",
};

export default async function ExplorerIndexPage() {
  const user = await requireSection("explorer");
  const connections = await filterAccessibleConnections(
    user,
    await listConnections(),
  );

  if (connections.length === 1) {
    redirect(`/explorer/${connections[0].id}`);
  }

  return (
    <>
      <PageHeader
        title="API Explorer"
        description="Browse every endpoint seeIt knows about, and try any of them safely."
      />
      <PageBody>
        {connections.length === 0 ? (
          <EmptyState
            icon={<Plug className="size-5" />}
            title="Nothing to explore yet"
            description="Import an API description file first and its endpoints will show up here."
            action={
              <Link href="/connections/new">
                <Button>
                  <Plus /> Import an API
                </Button>
              </Link>
            }
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {connections.map((connection) => {
              const isDb = connection.type === "database";
              return (
                <Link
                  key={connection.id}
                  href={`/explorer/${connection.id}`}
                  className="min-w-0"
                >
                  <Card className="flex h-full min-w-0 flex-col p-4 transition-shadow hover:shadow-md">
                    <div className="mb-3 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex min-w-0 flex-wrap items-center gap-1.5">
                          <h3 className="truncate text-sm font-semibold">
                            {connection.name}
                          </h3>
                          {isDb ? (
                            <Badge tone="brand">Database</Badge>
                          ) : (
                            <Badge tone="neutral">API</Badge>
                          )}
                        </div>
                        <p className="break-all font-mono text-[11px] text-ink-faint sm:truncate sm:break-normal">
                          {connection.baseUrl}
                        </p>
                      </div>
                    </div>

                    <div className="mb-3 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-ink-soft">
                      <StatusDot status={connection.status} />
                      <span>
                        {STATUS_LABEL[connection.status] ?? connection.status}
                      </span>
                      {connection.lastCheckedAt ? (
                        <span className="text-ink-faint">
                          · {formatRelativeTime(connection.lastCheckedAt)}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-auto flex flex-wrap gap-3 border-t border-line pt-3 text-xs text-ink-soft">
                      <span className="flex items-center gap-1">
                        {isDb ? (
                          <Database className="size-3.5 shrink-0" />
                        ) : (
                          <Route className="size-3.5 shrink-0" />
                        )}
                        {connection._count.operations}{" "}
                        {isDb ? "queries" : "endpoints"}
                      </span>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </PageBody>
    </>
  );
}
