import "server-only";

import { prisma } from "@/server/db";

/**
 * Give a dashboard the site shape: a Home page, one hidden tab, widgets on
 * that tab, and a header menu linking to Home.
 */
export async function ensureSiteStructure(dashboardId: string) {
  const existing = await prisma.page.findFirst({
    where: { dashboardId },
    select: { id: true },
  });
  if (!existing) {
    const page = await prisma.page.create({
      data: {
        dashboardId,
        name: "Home",
        slug: "home",
        sortOrder: 0,
        isHome: true,
        showTabs: false,
      },
    });

    const tab = await prisma.pageTab.create({
      data: {
        pageId: page.id,
        name: "Main",
        sortOrder: 0,
      },
    });

    await prisma.dashboardWidget.updateMany({
      where: { dashboardId, tabId: null },
      data: { tabId: tab.id },
    });

    await ensureHeaderMenu(dashboardId, page.id);
    return;
  }

  await ensurePageTabs(dashboardId);
  await ensureHeaderMenu(dashboardId);
}

async function ensurePageTabs(dashboardId: string) {
  const pages = await prisma.page.findMany({
    where: { dashboardId },
    include: { tabs: { select: { id: true } } },
  });
  for (const page of pages) {
    if (page.tabs.length > 0) continue;
    const tab = await prisma.pageTab.create({
      data: { pageId: page.id, name: "Main", sortOrder: 0 },
    });
    await prisma.dashboardWidget.updateMany({
      where: { dashboardId, tabId: null },
      data: { tabId: tab.id },
    });
  }
}

async function ensureHeaderMenu(dashboardId: string, homePageId?: string) {
  const existing = await prisma.siteMenu.findFirst({
    where: { dashboardId, location: "header" },
    include: { items: { select: { id: true } } },
  });
  if (existing) {
    if (existing.items.length > 0) return;
    const pageId =
      homePageId ??
      (
        await prisma.page.findFirst({
          where: { dashboardId, isHome: true },
          select: { id: true },
        })
      )?.id;
    if (!pageId) return;
    await prisma.siteMenuItem.create({
      data: {
        menuId: existing.id,
        pageId,
        label: "Home",
        sortOrder: 0,
      },
    });
    return;
  }

  const pageId =
    homePageId ??
    (
      await prisma.page.findFirst({
        where: { dashboardId, isHome: true },
        select: { id: true },
      })
    )?.id;

  await prisma.siteMenu.create({
    data: {
      dashboardId,
      location: "header",
      items: pageId
        ? {
            create: {
              label: "Home",
              pageId,
              sortOrder: 0,
            },
          }
        : undefined,
    },
  });
}

export async function backfillAllSites() {
  const dashboards = await prisma.dashboard.findMany({
    where: { pages: { none: {} } },
    select: { id: true },
  });
  for (const dashboard of dashboards) {
    await ensureSiteStructure(dashboard.id);
  }
}
