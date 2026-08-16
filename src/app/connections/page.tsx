import Link from "next/link";
import { Boxes, Database, Plug, Plus, Route } from "lucide-react";
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
import { LoadDemoButton } from "@/components/layout/LoadDemoButton";
import { ENGINE_DEFAULTS, type DbEngine } from "@/lib/database/engines";
import { formatRelativeTime } from "@/lib/utils";
import type { DbConfig } from "@/server/database/types";
import { isAdmin, requireSection } from "@/server/auth/permissions";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  healthy: "Working",
  failing: "Not responding",
  untested: "Not tested yet",
};

export default async function ConnectionsPage() {
  const user = await requireSection("connections");
  // Admins manage all connections (demo included); others only see what they
  // can call, with the demo always included unless they hid it.
  const connections = isAdmin(user)
    ? await listConnections()
    : await filterAccessibleConnections(user, await listConnections());

  return (
    <>
      <PageHeader
        title="Connections"
        description="Each connection is an API or database Argent can read from. Credentials stay encrypted on the server."
        actions={
          <Link href="/connections/new">
            <Button>
              <Plus />
              <span className="hidden sm:inline">Add a connection</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </Link>
        }
      />

      <PageBody>
        {connections.length === 0 ? (
          <EmptyState
            icon={<Plug className="size-5" />}
            title="Nothing connected yet"
            description="Import an OpenAPI file, or connect PostgreSQL, MariaDB or ClickHouse and build objects from SQL."
            action={
              <div className="flex flex-wrap items-start justify-center gap-2">
                <Link href="/connections/new">
                  <Button>
                    <Plus /> Add a connection
                  </Button>
                </Link>
                <LoadDemoButton label="Or load the example" />
              </div>
            }
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {connections.map((connection) => {
              const isDb = connection.type === "database";
              const dbConfig = connection.dbConfig as unknown as DbConfig | null;
              const engineLabel =
                isDb && dbConfig?.engine
                  ? ENGINE_DEFAULTS[dbConfig.engine as DbEngine]?.label
                  : null;

              return (
                <Link
                  key={connection.id}
                  href={`/connections/${connection.id}`}
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
                            <Badge tone="brand">
                              {engineLabel ?? "Database"}
                            </Badge>
                          ) : (
                            <Badge tone="neutral">API</Badge>
                          )}
                        </div>
                        <p className="break-all font-mono text-[11px] text-ink-faint sm:truncate sm:break-normal">
                          {connection.baseUrl}
                        </p>
                      </div>
                      <div className="shrink-0">
                        {connection.readOnly ? (
                          <Badge tone="neutral">Read only</Badge>
                        ) : (
                          <Badge tone="warning">Writes on</Badge>
                        )}
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
                      <span className="flex items-center gap-1">
                        <Boxes className="size-3.5 shrink-0" />
                        {connection._count.dataObjects} objects
                      </span>
                    </div>

                    {connection.status === "failing" && connection.lastError ? (
                      <p className="mt-3 line-clamp-2 rounded-md bg-danger-soft px-2 py-1.5 text-[11px] text-danger">
                        {connection.lastError}
                      </p>
                    ) : null}
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
