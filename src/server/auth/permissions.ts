import "server-only";

import { redirect } from "next/navigation";
import {
  canAccessSection,
  canViewDashboard as canViewDashboardByGrant,
  filterViewableDashboards as filterDashboardsByGrant,
  getSessionUser,
  isAdmin,
  canEditSites,
  type SessionUser,
} from "@/server/auth/acl";
import { canAccessConnection } from "@/server/auth/api-grants";
import { needsOnboarding } from "@/server/auth/account";
import {
  canSeeDemo,
  getDemoConnectionId,
  isDemoDashboardSlug,
} from "@/server/demo/access";
import { prisma } from "@/server/db";
import type { AppSection } from "@/lib/auth/sections";

export {
  canAccessSection,
  canEditSites,
  getSessionUser,
  isAdmin,
  type SessionUser,
} from "@/server/auth/acl";

/**
 * Dashboard visibility: section + DashboardGrant + connection ApiGrant.
 * The bundled demo is always allowed (unless the user hid it).
 */
export async function canViewDashboard(
  user: SessionUser,
  dashboardId: string,
): Promise<boolean> {
  if (!(await canViewDashboardByGrant(user, dashboardId))) return false;
  if (isAdmin(user)) return true;

  const dashboard = await prisma.dashboard.findUnique({
    where: { id: dashboardId },
    select: { slug: true, connectionId: true },
  });
  if (!dashboard) return false;
  if (isDemoDashboardSlug(dashboard.slug)) return canSeeDemo(user);
  if (!dashboard.connectionId) return true;
  return canAccessConnection(user, dashboard.connectionId);
}

export async function filterViewableDashboards<
  T extends {
    id: string;
    slug?: string;
    connectionId?: string | null;
    published?: boolean;
  },
>(user: SessionUser, dashboards: T[]): Promise<T[]> {
  const byGrant = await filterDashboardsByGrant(user, dashboards);
  if (isAdmin(user) || byGrant.length === 0) return byGrant;

  const demoId = await getDemoConnectionId();
  const connectionIds = [
    ...new Set(
      byGrant
        .map((d) => d.connectionId)
        .filter((id): id is string => Boolean(id) && id !== demoId),
    ),
  ];

  if (connectionIds.length === 0) return byGrant;

  const accessible = new Set<string>();
  await Promise.all(
    connectionIds.map(async (connectionId) => {
      if (await canAccessConnection(user, connectionId)) {
        accessible.add(connectionId);
      }
    }),
  );

  return byGrant.filter((d) => {
    if (isDemoDashboardSlug(d.slug)) return true;
    if (!d.connectionId || d.connectionId === demoId) return true;
    return accessible.has(d.connectionId);
  });
}

export async function requireUser(options?: {
  /** Allow users who still need the first-login wizard (onboarding page only). */
  allowIncompleteOnboarding?: boolean;
}): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!options?.allowIncompleteOnboarding && needsOnboarding(user)) {
    redirect("/onboarding");
  }
  return user;
}

export async function requireSection(
  section: AppSection,
): Promise<SessionUser> {
  const user = await requireUser();
  if (!canAccessSection(user, section)) {
    redirect("/?error=forbidden");
  }
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!isAdmin(user)) redirect("/?error=forbidden");
  return user;
}

export async function requireSiteEditor(): Promise<SessionUser> {
  const user = await requireUser();
  if (!canEditSites(user)) redirect("/?error=forbidden");
  return user;
}

/** For server actions: throws instead of redirecting so callers can return an error. */
export async function ensureSiteEditor(): Promise<SessionUser> {
  const user = await requireUser();
  if (!canEditSites(user)) {
    throw new Error("You don't have permission to edit sites.");
  }
  return user;
}
