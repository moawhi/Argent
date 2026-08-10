import "server-only";

import { prisma } from "@/server/db";
import type { AppSection } from "@/lib/auth/sections";
import type { ThemeId } from "@/lib/theme";
import { isThemeId } from "@/lib/theme";
import { readSessionUserId } from "@/server/auth/session";
import {
  canSeeDemo,
  isDemoDashboardSlug,
} from "@/server/demo/access";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  active: boolean;
  theme: ThemeId;
  mustChangePassword: boolean;
  onboardingCompletedAt: Date | null;
  /** Soft-hide the bundled demo from this user's lists (admins ignore). */
  hideDemo: boolean;
  role: {
    id: string;
    key: string;
    label: string;
  };
  sectionOverrides: string[];
  roleSections: string[];
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const userId = await readSessionUserId();
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      role: {
        include: { sectionGrants: true },
      },
      sectionGrants: true,
    },
  });

  if (!user || !user.active) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    active: user.active,
    theme: isThemeId(user.theme) ? user.theme : "light",
    mustChangePassword: user.mustChangePassword,
    onboardingCompletedAt: user.onboardingCompletedAt,
    hideDemo: user.hideDemo,
    role: {
      id: user.role.id,
      key: user.role.key,
      label: user.role.label,
    },
    roleSections: user.role.sectionGrants.map((g) => g.section),
    sectionOverrides: user.sectionGrants.map((g) => g.section),
  };
}

export function isAdmin(user: SessionUser): boolean {
  return user.role.key === "admin";
}

export function canAccessSection(
  user: SessionUser,
  section: AppSection,
): boolean {
  if (isAdmin(user)) return true;
  if (user.sectionOverrides.includes(section)) return true;
  return user.roleSections.includes(section);
}

export async function canViewDashboard(
  user: SessionUser,
  dashboardId: string,
): Promise<boolean> {
  if (isAdmin(user)) return true;
  if (!canAccessSection(user, "dashboards")) return false;

  const dashboard = await prisma.dashboard.findUnique({
    where: { id: dashboardId },
    select: { id: true, slug: true },
  });
  if (!dashboard) return false;

  if (isDemoDashboardSlug(dashboard.slug)) {
    return canSeeDemo(user);
  }

  const grants = await prisma.dashboardGrant.findMany({
    where: { dashboardId },
  });

  // No grants → open to anyone who can open the Dashboards section.
  if (grants.length === 0) return true;

  return grants.some(
    (g) => g.userId === user.id || g.roleId === user.role.id,
  );
}

export async function filterViewableDashboards<
  T extends { id: string; slug?: string },
>(user: SessionUser, dashboards: T[]): Promise<T[]> {
  if (!canAccessSection(user, "dashboards")) return [];
  if (dashboards.length === 0) return [];

  const showDemo = canSeeDemo(user);

  if (isAdmin(user)) {
    return dashboards.filter(
      (d) => !isDemoDashboardSlug(d.slug) || showDemo,
    );
  }

  const ids = dashboards.map((d) => d.id);
  const grants = await prisma.dashboardGrant.findMany({
    where: { dashboardId: { in: ids } },
  });

  const byDashboard = new Map<string, typeof grants>();
  for (const g of grants) {
    const list = byDashboard.get(g.dashboardId) ?? [];
    list.push(g);
    byDashboard.set(g.dashboardId, list);
  }

  return dashboards.filter((d) => {
    if (isDemoDashboardSlug(d.slug)) return showDemo;

    const list = byDashboard.get(d.id);
    if (!list || list.length === 0) return true;
    return list.some(
      (g) => g.userId === user.id || g.roleId === user.role.id,
    );
  });
}
