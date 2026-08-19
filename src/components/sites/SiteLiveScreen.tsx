import Link from "next/link";
import { notFound } from "next/navigation";
import { getSite } from "@/server/sites/service";
import { SiteLiveView } from "@/components/sites/SiteLiveView";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/primitives";
import {
  canAccessSection,
  canEditSites,
  canViewDashboard,
  requireUser,
} from "@/server/auth/permissions";

export async function SiteLiveScreen({
  siteSlug,
  pageSlug,
  tabId,
  autoFullscreen = false,
}: {
  siteSlug: string;
  pageSlug?: string;
  tabId?: string | null;
  autoFullscreen?: boolean;
}) {
  const user = await requireUser();
  if (!siteSlug) notFound();

  let site;
  try {
    site = await getSite(siteSlug, pageSlug, tabId);
  } catch (error) {
    console.error("[sites] live getSite failed", { siteSlug, pageSlug, error });
    notFound();
  }

  if (!site) {
    console.error("[sites] live getSite returned null", { siteSlug, pageSlug });
    notFound();
  }

  const editor = canEditSites(user);

  if (!(await canViewDashboard(user, site.id))) {
    const unpublishedViewer =
      !site.published &&
      !editor &&
      canAccessSection(user, "dashboards");
    return (
      <div className="flex h-screen items-center justify-center bg-canvas p-6">
        <EmptyState
          title={
            unpublishedViewer
              ? "This site isn't published yet"
              : "You don't have access to this site"
          }
          description={
            unpublishedViewer
              ? "Only editors can preview it until someone publishes."
              : "Ask an admin to share it with you."
          }
          action={
            <Link href="/sites">
              <Button>Back to sites</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <SiteLiveView
      site={site}
      autoFullscreen={autoFullscreen}
      canPublish={editor}
      canEdit={editor}
    />
  );
}
