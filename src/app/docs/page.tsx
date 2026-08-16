import Link from "next/link";
import { BookOpen, Cable, Database, FileJson, Plug, Plus, Route } from "lucide-react";
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
import {
  HideDemoButton,
  ShowDemoButton,
} from "@/components/demo/HideDemoButton";
import { formatRelativeTime } from "@/lib/utils";
import { isAdmin, requireSection } from "@/server/auth/permissions";
import { isDemoConnectionName } from "@/server/demo/access";
import { isDemoInstalled } from "@/server/demo/seed";
import { GUIDES } from "@/lib/docs/guides";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  healthy: "Working",
  failing: "Not responding",
  untested: "Not tested yet",
};

export default async function DocsIndexPage() {
  const user = await requireSection("docs");
  const [allConnections, installed] = await Promise.all([
    listConnections(),
    isDemoInstalled(),
  ]);
  const connections = await filterAccessibleConnections(user, allConnections);
  const admin = isAdmin(user);

  return (
    <>
      <PageHeader
        title="Help & Docs"
        description="Start with the guides, then open the reference built from each connection’s spec or catalog."
      />
      <PageBody className="space-y-8">
        <section className="space-y-3">
          <div className="flex items-end justify-between">
            <h2 className="font-[family-name:var(--font-landing-display)] text-lg font-medium tracking-tight">
              Guides
            </h2>
            <Link href="/docs/guides" className="text-xs text-brand hover:underline">
              See all
            </Link>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {GUIDES.map((guide) => (
              <Link key={guide.slug} href={`/docs/guides/${guide.slug}`}>
                <Card className="h-full p-4 transition-shadow hover:shadow-md">
                  {guide.slug === "api" ? (
                    <Plug className="mb-2 size-4 text-brand" />
                  ) : guide.slug === "openapi" ? (
                    <FileJson className="mb-2 size-4 text-brand" />
                  ) : guide.slug === "mcp" ? (
                    <Cable className="mb-2 size-4 text-brand" />
                  ) : (
                    <BookOpen className="mb-2 size-4 text-brand" />
                  )}
                  <p className="text-sm font-semibold">{guide.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                    {guide.summary}
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        {user.hideDemo && installed && !admin ? (
          <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-sm text-ink-soft">
              You hid the bundled sample docs.
            </p>
            <ShowDemoButton />
          </Card>
        ) : null}

        <section className="space-y-3">
          <h2 className="font-[family-name:var(--font-landing-display)] text-lg font-medium tracking-tight">
            From your connections
          </h2>
        {connections.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="size-5" />}
            title="No connection docs yet"
            description="Import an OpenAPI file or connect a database, and Argent will build a reference from what it finds."
            action={
              <Link href="/connections/new">
                <Button>
                  <Plus /> Add a connection
                </Button>
              </Link>
            }
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {connections.map((connection) => {
              const demo = isDemoConnectionName(connection.name);
              const isDb = connection.type === "database";
              return (
                <Card
                  key={connection.id}
                  className="flex h-full min-w-0 flex-col p-4 transition-shadow hover:shadow-md"
                >
                  <Link
                    href={`/docs/${connection.id}`}
                    className="flex min-w-0 flex-1 flex-col"
                  >
                    <div className="mb-3 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex min-w-0 flex-wrap items-center gap-1.5">
                          <BookOpen className="size-3.5 shrink-0 text-brand" />
                          <h3 className="truncate text-sm font-semibold">
                            {connection.name}
                          </h3>
                          <Badge tone={isDb ? "brand" : "neutral"}>
                            {isDb ? "Database" : "API"}
                          </Badge>
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
                        {isDb
                          ? `${connection._count.operations} saved quer${
                              connection._count.operations === 1 ? "y" : "ies"
                            }`
                          : `${connection._count.operations} endpoints`}
                      </span>
                      {isDb ? (
                        <span className="text-ink-faint">· schema catalog</span>
                      ) : (
                        <span className="text-ink-faint">· documented</span>
                      )}
                    </div>
                  </Link>
                  {demo && !admin ? (
                    <div className="mt-3 border-t border-line pt-2">
                      <HideDemoButton />
                    </div>
                  ) : null}
                </Card>
              );
            })}
          </div>
        )}
        </section>
      </PageBody>
    </>
  );
}
