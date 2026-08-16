import Link from "next/link";
import { LayoutDashboard, Plus } from "lucide-react";
import { listDashboards } from "@/server/dashboards/service";
import { listConnections } from "@/server/connections/service";
import { filterAccessibleConnections } from "@/server/auth/api-grants";
import { PageBody, PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/primitives";
import { NewDashboardButton } from "@/components/dashboard/NewDashboardButton";
import { LoadDemoButton } from "@/components/layout/LoadDemoButton";
import {
  HideDemoButton,
  ShowDemoButton,
} from "@/components/demo/HideDemoButton";
import { formatRelativeTime } from "@/lib/utils";
import {
  filterViewableDashboards,
  isAdmin,
  requireSection,
} from "@/server/auth/permissions";
import { isDemoDashboardSlug } from "@/server/demo/access";
import { isDemoInstalled } from "@/server/demo/seed";

export const dynamic = "force-dynamic";

export default async function DashboardsPage() {
  const user = await requireSection("dashboards");
  const [allDashboards, allConnections, installed] = await Promise.all([
    listDashboards(),
    listConnections(),
    isDemoInstalled(),
  ]);
  const [dashboards, connections] = await Promise.all([
    filterViewableDashboards(user, allDashboards),
    filterAccessibleConnections(user, allConnections),
  ]);

  const admin = isAdmin(user);
  const connectionOptions = connections.map((c) => ({
    id: c.id,
    name: c.name,
  }));

  return (
    <>
      <PageHeader
        title="Dashboards"
        description="Pages of tables, charts and cards, all reading live from your APIs."
        actions={
          <NewDashboardButton connections={connectionOptions} />
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

        {dashboards.length === 0 ? (
          <EmptyState
            icon={<LayoutDashboard className="size-5" />}
            title="No dashboards yet"
            description={
              connections.length === 0
                ? "Import an API first, build an object or two, then arrange them on a dashboard."
                : "Create a dashboard and drop your objects onto it."
            }
            action={
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
                <NewDashboardButton connections={connectionOptions} />
              )
            }
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {dashboards.map((dashboard) => {
              const demo = isDemoDashboardSlug(dashboard.slug);
              return (
                <Card
                  key={dashboard.id}
                  className="relative h-full p-4 transition-shadow hover:shadow-md"
                >
                  <Link
                    href={`/dashboards/${dashboard.slug}`}
                    className="block"
                  >
                    <h3 className="text-sm font-semibold">{dashboard.name}</h3>
                    {dashboard.description ? (
                      <p className="mt-0.5 line-clamp-2 text-xs text-ink-soft">
                        {dashboard.description}
                      </p>
                    ) : null}
                    <p className="mt-3 text-[11px] text-ink-faint">
                      {dashboard._count.widgets} tile
                      {dashboard._count.widgets === 1 ? "" : "s"}
                      {dashboard.connection
                        ? ` · ${dashboard.connection.name}`
                        : ""}
                      {" · updated "}
                      {formatRelativeTime(dashboard.updatedAt)}
                    </p>
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
      </PageBody>
    </>
  );
}
