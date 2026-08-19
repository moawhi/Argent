import Link from "next/link";
import { AppWindow, Plus } from "lucide-react";
import { listDashboards } from "@/server/dashboards/service";
import { listConnections } from "@/server/connections/service";
import { filterAccessibleConnections } from "@/server/auth/api-grants";
import { PageBody, PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge, Card, EmptyState } from "@/components/ui/primitives";
import { NewSiteButton } from "@/components/sites/NewSiteButton";
import { LoadDemoButton } from "@/components/layout/LoadDemoButton";
import {
  HideDemoButton,
  ShowDemoButton,
} from "@/components/demo/HideDemoButton";
import { formatRelativeTime } from "@/lib/utils";
import {
  canEditSites,
  filterViewableDashboards,
  isAdmin,
  requireSection,
} from "@/server/auth/permissions";
import { isDemoDashboardSlug } from "@/server/demo/access";
import { isDemoInstalled } from "@/server/demo/seed";
import { backfillAllSites } from "@/server/sites/backfill";

export const dynamic = "force-dynamic";

export default async function SitesPage() {
  const user = await requireSection("dashboards");
  await backfillAllSites();
  const [allSites, allConnections, installed] = await Promise.all([
    listDashboards(),
    listConnections(),
    isDemoInstalled(),
  ]);
  const [sites, connections] = await Promise.all([
    filterViewableDashboards(user, allSites),
    filterAccessibleConnections(user, allConnections),
  ]);

  const admin = isAdmin(user);
  const editor = canEditSites(user);
  const connectionOptions = connections.map((c) => ({
    id: c.id,
    name: c.name,
  }));

  return (
    <>
      <PageHeader
        title="Sites"
        description={
          editor
            ? "Pages, menus and tabs of tables, charts, copy and cards — reading live from your APIs."
            : "Published sites shared with you."
        }
        actions={
          editor ? <NewSiteButton connections={connectionOptions} /> : undefined
        }
      />

      <PageBody className="space-y-4">
        {user.hideDemo && installed && !admin ? (
          <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-sm text-ink-soft">
              You hid the bundled sample. It is still installed for
              everyone else.
            </p>
            <ShowDemoButton />
          </Card>
        ) : null}

        {sites.length === 0 ? (
          <EmptyState
            icon={<AppWindow className="size-5" />}
            title={editor ? "No sites yet" : "No published sites yet"}
            description={
              editor
                ? connections.length === 0
                  ? "Import an API first, or start from a template and add objects later."
                  : "Create a site from a template, or start blank and add pages."
                : "When someone publishes a site and shares it with you, it will show up here."
            }
            action={
              editor ? (
              connections.length === 0 ? (
                <div className="flex flex-wrap items-start justify-center gap-2">
                  <Link href="/connections/new">
                    <Button>
                      <Plus /> Import an API
                    </Button>
                  </Link>
                  <LoadDemoButton label="Or load the example" />
                </div>
              ) : (
                <NewSiteButton connections={connectionOptions} />
              )
              ) : undefined
            }
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {sites.map((site) => {
              const demo = isDemoDashboardSlug(site.slug);
              return (
                <Card
                  key={site.id}
                  className="relative h-full p-4 transition-shadow hover:shadow-md"
                >
                  <Link
                    href={
                      editor
                        ? `/sites/${site.slug}`
                        : `/view/${site.slug}`
                    }
                    className="block"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold">{site.name}</h3>
                      {site.published ? (
                        <Badge tone="positive">Published</Badge>
                      ) : null}
                    </div>
                    {site.description ? (
                      <p className="mt-0.5 line-clamp-2 text-xs text-ink-soft">
                        {site.description}
                      </p>
                    ) : null}
                    <p className="mt-3 text-[11px] text-ink-faint">
                      {site._count.pages} page
                      {site._count.pages === 1 ? "" : "s"}
                      {" · "}
                      {site._count.widgets} tile
                      {site._count.widgets === 1 ? "" : "s"}
                      {site.connection ? ` · ${site.connection.name}` : ""}
                      {" · updated "}
                      {formatRelativeTime(site.updatedAt)}
                    </p>
                  </Link>
                  {editor && site.published ? (
                    <div className="mt-3 border-t border-line pt-2">
                      <Link
                        href={`/view/${site.slug}?fs=1`}
                        className="text-xs text-brand hover:underline"
                      >
                        View live
                      </Link>
                    </div>
                  ) : null}
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
      </PageBody>
    </>
  );
}
