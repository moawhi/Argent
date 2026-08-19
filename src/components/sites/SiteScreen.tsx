import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSite } from "@/server/sites/service";
import { listObjects } from "@/server/objects/service";
import { PageBody, PageHeader } from "@/components/layout/PageHeader";
import { SiteWorkspace } from "@/components/sites/SiteWorkspace";
import { SiteSettings } from "@/components/sites/SiteSettings";
import { SitePublishControls } from "@/components/sites/SitePublishControls";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/primitives";
import {
  canEditSites,
  canViewDashboard,
  isAdmin,
  requireSection,
} from "@/server/auth/permissions";
import { getDashboardAccess } from "@/server/auth/users";
import { isDemoDashboardSlug } from "@/server/demo/access";
import { siteLivePath } from "@/lib/sites/paths";

export async function SiteScreen({
  siteSlug,
  pageSlug,
  tabId,
}: {
  siteSlug: string;
  pageSlug?: string;
  tabId?: string | null;
}) {
  const user = await requireSection("dashboards");
  if (!siteSlug) notFound();

  let site;
  try {
    site = await getSite(siteSlug, pageSlug, tabId);
  } catch (error) {
    console.error("[sites] getSite failed", { siteSlug, pageSlug, error });
    return (
      <>
        <PageHeader
          title="Couldn't open site"
          crumbs={[{ label: "Sites", href: "/sites" }]}
        />
        <PageBody>
          <EmptyState
            title="This site failed to load"
            description={
              error instanceof Error
                ? error.message
                : "Something went wrong while opening this site."
            }
            action={
              <Link href="/sites">
                <Button>Back to sites</Button>
              </Link>
            }
          />
        </PageBody>
      </>
    );
  }

  if (!site) {
    console.error("[sites] getSite returned null", { siteSlug, pageSlug });
    notFound();
  }

  if (!(await canViewDashboard(user, site.id))) {
    return (
      <>
        <PageHeader
          title={site.name}
          crumbs={[
            { label: "Sites", href: "/sites" },
            { label: site.name },
          ]}
        />
        <PageBody>
          <EmptyState
            title="You don't have access to this site"
            description="Ask an admin to share it with you, or open a different site."
            action={
              <Link href="/sites">
                <Button>Back to sites</Button>
              </Link>
            }
          />
        </PageBody>
      </>
    );
  }

  if (!canEditSites(user)) {
    redirect(
      siteLivePath(
        site.slug,
        site.currentPage.isHome ? undefined : site.currentPage.slug,
        tabId,
      ),
    );
  }

  const demo = isDemoDashboardSlug(site.slug);
  const admin = isAdmin(user);

  const [objects, accessBundle] = await Promise.all([
    listObjects(),
    admin ? getDashboardAccess(site.id) : null,
  ]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title={site.currentPage.name}
        description={site.description ?? undefined}
        crumbs={[
          { label: "Sites", href: "/sites" },
          { label: site.name, href: `/sites/${site.slug}` },
          ...(site.currentPage.isHome
            ? []
            : [{ label: site.currentPage.name }]),
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <SitePublishControls
              dashboardId={site.id}
              siteSlug={site.slug}
              pageSlug={
                site.currentPage.isHome ? undefined : site.currentPage.slug
              }
              published={site.published}
            />
            <SiteSettings
              dashboardId={site.id}
              name={site.name}
              description={site.description}
              filters={site.filters}
              filtersVisible={site.filtersVisible}
              published={site.published}
              slug={site.slug}
              pages={site.pages}
              menuId={site.menu?.id ?? null}
              menuItems={site.menu?.items ?? []}
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
          </div>
        }
      />

      <SiteWorkspace
        site={site}
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
