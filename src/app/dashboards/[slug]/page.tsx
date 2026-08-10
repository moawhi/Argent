import { notFound } from "next/navigation";
import { getDashboard } from "@/server/dashboards/service";
import { listObjects } from "@/server/objects/service";
import { PageHeader } from "@/components/layout/PageHeader";
import { DashboardCanvas } from "@/components/dashboard/DashboardCanvas";
import { DashboardMenu } from "@/components/dashboard/DashboardMenu";
import {
  canViewDashboard,
  isAdmin,
  requireSection,
} from "@/server/auth/permissions";
import { getDashboardAccess } from "@/server/auth/users";
import { isDemoDashboardSlug } from "@/server/demo/access";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await requireSection("dashboards");
  const { slug } = await params;
  const dashboard = await getDashboard(slug);
  if (!dashboard) notFound();

  if (!(await canViewDashboard(user, dashboard.id))) {
    notFound();
  }

  const demo = isDemoDashboardSlug(dashboard.slug);
  const admin = isAdmin(user);

  const [objects, accessBundle] = await Promise.all([
    listObjects(),
    admin ? getDashboardAccess(dashboard.id) : null,
  ]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title={dashboard.name}
        description={dashboard.description ?? undefined}
        crumbs={[
          { label: "Dashboards", href: "/dashboards" },
          { label: dashboard.name },
        ]}
        actions={
          <DashboardMenu
            dashboardId={dashboard.id}
            name={dashboard.name}
            description={dashboard.description}
            filters={dashboard.filters}
            filtersVisible={dashboard.filtersVisible}
            isDemo={demo}
            canDelete={!demo || admin}
            canHideDemo={demo && !admin}
            access={
              accessBundle
                ? {
                    roles: accessBundle.roles.map((r) => ({
                      id: r.id,
                      label: r.label,
                      key: r.key,
                    })),
                    users: accessBundle.users,
                    selectedRoleIds: accessBundle.grants
                      .filter((g) => g.roleId)
                      .map((g) => g.roleId!),
                    selectedUserIds: accessBundle.grants
                      .filter((g) => g.userId)
                      .map((g) => g.userId!),
                  }
                : null
            }
          />
        }
      />

      <DashboardCanvas
        dashboardId={dashboard.id}
        filters={dashboard.filters}
        filtersVisible={dashboard.filtersVisible}
        widgets={dashboard.widgets}
        availableObjects={objects.map((object) => ({
          id: object.id,
          name: object.name,
          kind: object.kind,
          connectionName: object.connection.name,
          summary: object.operation?.summary ?? null,
        }))}
      />
    </div>
  );
}
