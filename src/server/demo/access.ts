import "server-only";

import { prisma } from "@/server/db";

/** Fixed identity for the bundled AdLogic example (name match until a schema flag). */
export const DEMO_CONNECTION_NAME = "AdLogic (demo)";
export const DEMO_DASHBOARD_SLUG = "campaign-performance";

export function isDemoConnectionName(name: string | null | undefined): boolean {
  return name === DEMO_CONNECTION_NAME;
}

export function isDemoDashboardSlug(slug: string | null | undefined): boolean {
  return slug === DEMO_DASHBOARD_SLUG;
}

/** Lookup — demo is identified by fixed name until a schema flag exists. */
export async function getDemoConnectionId(): Promise<string | null> {
  const demo = await prisma.connection.findFirst({
    where: { name: DEMO_CONNECTION_NAME },
    select: { id: true },
  });
  return demo?.id ?? null;
}

export async function isDemoConnectionId(
  connectionId: string,
): Promise<boolean> {
  const demoId = await getDemoConnectionId();
  return demoId !== null && demoId === connectionId;
}

/**
 * Whether this user should see the bundled demo in lists / deep links.
 * Admins always see it; others respect their hideDemo preference.
 */
export function canSeeDemo(user: {
  hideDemo: boolean;
  role: { key: string };
}): boolean {
  if (user.role.key === "admin") return true;
  return !user.hideDemo;
}

export async function setUserHideDemo(
  userId: string,
  hide: boolean,
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { hideDemo: hide },
  });
}
