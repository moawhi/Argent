import "server-only";

import { prisma } from "@/server/db";
import { slugify } from "@/lib/utils";
import type { Prisma } from "@prisma/client";
import {
  createDashboard,
  toWidgetView,
  type FilterDefinition,
  type MenuItemView,
  type PageSummary,
  type WidgetView,
} from "@/server/dashboards/service";
import { ensureSiteStructure } from "@/server/sites/backfill";
import { getSiteTemplate } from "@/lib/sites/templates";
import { createCampaignObjects } from "@/server/sites/campaign-objects";
import type { BlockKind, TemplateWidget } from "@/lib/sites/types";

export interface SiteView {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  connectionId: string | null;
  filtersVisible: boolean;
  published: boolean;
  publishedAt: Date | null;
  filters: FilterDefinition[];
  pages: PageSummary[];
  menu: { id: string; items: MenuItemView[] } | null;
  currentPage: PageSummary;
  currentTab: { id: string; name: string; sortOrder: number };
  widgets: WidgetView[];
}

function nestMenuItems(
  items: {
    id: string;
    label: string;
    pageId: string | null;
    sortOrder: number;
    parentId: string | null;
    page: { slug: string } | null;
  }[],
): MenuItemView[] {
  const byParent = new Map<string | null, typeof items>();
  for (const item of items) {
    const key = item.parentId;
    const list = byParent.get(key) ?? [];
    list.push(item);
    byParent.set(key, list);
  }

  function childrenOf(parentId: string | null): MenuItemView[] {
    return (byParent.get(parentId) ?? [])
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((item) => ({
        id: item.id,
        label: item.label,
        pageId: item.pageId,
        pageSlug: item.page?.slug ?? null,
        sortOrder: item.sortOrder,
        children: childrenOf(item.id),
      }));
  }

  return childrenOf(null);
}

function lookupKey(idOrSlug: unknown): string | null {
  if (typeof idOrSlug === "string") {
    const trimmed = idOrSlug.trim();
    return trimmed || null;
  }
  if (Array.isArray(idOrSlug)) return lookupKey(idOrSlug[0]);
  return null;
}

function toPageSummary(page: {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  isHome: boolean;
  showTabs: boolean;
  tabs: { id: string; name: string; sortOrder: number }[];
}): PageSummary {
  return {
    id: page.id,
    name: page.name,
    slug: page.slug,
    sortOrder: page.sortOrder,
    isHome: page.isHome,
    showTabs: page.showTabs,
    tabs: page.tabs.map((tab) => ({
      id: tab.id,
      name: tab.name,
      sortOrder: tab.sortOrder,
    })),
  };
}

export async function getSite(
  idOrSlug: string,
  pageSlug?: string | null,
  tabId?: string | null,
): Promise<SiteView | null> {
  const key = lookupKey(idOrSlug);
  if (!key) return null;

  const dashboard = await prisma.dashboard.findFirst({
    where: { OR: [{ id: key }, { slug: key }] },
    include: {
      filters: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!dashboard) return null;
  await ensureSiteStructure(dashboard.id);

  const pageRows = await prisma.page.findMany({
    where: { dashboardId: dashboard.id },
    orderBy: { sortOrder: "asc" },
    include: { tabs: { orderBy: { sortOrder: "asc" } } },
  });

  const pages = pageRows.map(toPageSummary);

  const requestedPage = pageSlug ? lookupKey(pageSlug) : null;
  const currentPage =
    (requestedPage
      ? pages.find((page) => page.slug === requestedPage)
      : pages.find((page) => page.isHome)) ?? pages[0];

  if (!currentPage) return null;

  let currentTab =
    (tabId
      ? currentPage.tabs.find((tab) => tab.id === tabId)
      : currentPage.tabs[0]) ?? currentPage.tabs[0];

  if (!currentTab) {
    const tab = await prisma.pageTab.create({
      data: { pageId: currentPage.id, name: "Main", sortOrder: 0 },
    });
    currentTab = { id: tab.id, name: tab.name, sortOrder: tab.sortOrder };
    currentPage.tabs = [currentTab];
  }

  const widgetsRaw = await prisma.dashboardWidget.findMany({
    where: { tabId: currentTab.id },
    orderBy: [{ y: "asc" }, { x: "asc" }],
    include: {
      dataObject: {
        include: {
          connection: { select: { id: true, readOnly: true } },
          operation: {
            select: {
              id: true,
              operationKey: true,
              method: true,
              path: true,
            },
          },
        },
      },
    },
  });

  const headerMenu = await prisma.siteMenu.findFirst({
    where: { dashboardId: dashboard.id, location: "header" },
    include: {
      items: {
        orderBy: { sortOrder: "asc" },
        include: { page: { select: { slug: true } } },
      },
    },
  });

  return {
    id: dashboard.id,
    name: dashboard.name,
    slug: dashboard.slug,
    description: dashboard.description,
    connectionId: dashboard.connectionId,
    filtersVisible: dashboard.filtersVisible,
    published: dashboard.published,
    publishedAt: dashboard.publishedAt,
    filters: dashboard.filters.map((filter) => ({
      id: filter.id,
      key: filter.key,
      label: filter.label,
      kind: filter.kind,
      defaultValue: filter.defaultValue,
      options: filter.options,
      sortOrder: filter.sortOrder,
    })) as FilterDefinition[],
    pages,
    menu: headerMenu
      ? { id: headerMenu.id, items: nestMenuItems(headerMenu.items) }
      : null,
    currentPage,
    currentTab,
    widgets: widgetsRaw.map(toWidgetView),
  };
}

async function uniquePageSlug(
  dashboardId: string,
  base: string,
  excludeId?: string,
): Promise<string> {
  const root = slugify(base) || "page";
  let candidate = root;
  let suffix = 2;
  while (
    await prisma.page.findFirst({
      where: {
        dashboardId,
        slug: candidate,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    })
  ) {
    candidate = `${root}-${suffix++}`;
  }
  return candidate;
}

export async function createPage(
  dashboardId: string,
  input: { name: string; slug?: string },
) {
  const count = await prisma.page.count({ where: { dashboardId } });
  const name = input.name.trim() || "Untitled page";
  const page = await prisma.page.create({
    data: {
      dashboardId,
      name,
      slug: input.slug
        ? await uniquePageSlug(dashboardId, input.slug)
        : await uniquePageSlug(dashboardId, name),
      sortOrder: count,
      isHome: count === 0,
      showTabs: false,
      tabs: { create: { name: "Main", sortOrder: 0 } },
    },
  });
  return page;
}

export async function updatePage(
  pageId: string,
  data: {
    name?: string;
    slug?: string;
    isHome?: boolean;
    showTabs?: boolean;
  },
) {
  const page = await prisma.page.findUnique({
    where: { id: pageId },
    select: { id: true, dashboardId: true },
  });
  if (!page) throw new Error("That page no longer exists.");

  if (data.isHome) {
    await prisma.page.updateMany({
      where: { dashboardId: page.dashboardId },
      data: { isHome: false },
    });
  }

  const slug =
    data.slug !== undefined
      ? await uniquePageSlug(page.dashboardId, data.slug, pageId)
      : undefined;

  return prisma.page.update({
    where: { id: pageId },
    data: {
      name: data.name?.trim() || undefined,
      slug,
      isHome: data.isHome,
      showTabs: data.showTabs,
    },
  });
}

export async function reorderPages(dashboardId: string, pageIds: string[]) {
  await prisma.$transaction(
    pageIds.map((id, index) =>
      prisma.page.update({
        where: { id },
        data: { sortOrder: index },
      }),
    ),
  );
}

export async function deletePage(pageId: string) {
  const page = await prisma.page.findUnique({
    where: { id: pageId },
    select: { id: true, dashboardId: true, isHome: true },
  });
  if (!page) throw new Error("That page no longer exists.");

  const count = await prisma.page.count({
    where: { dashboardId: page.dashboardId },
  });
  if (count <= 1) throw new Error("A site needs at least one page.");

  await prisma.page.delete({ where: { id: pageId } });

  if (page.isHome) {
    const next = await prisma.page.findFirst({
      where: { dashboardId: page.dashboardId },
      orderBy: { sortOrder: "asc" },
    });
    if (next) {
      await prisma.page.update({
        where: { id: next.id },
        data: { isHome: true },
      });
    }
  }
}

export async function createTab(pageId: string, name?: string) {
  const count = await prisma.pageTab.count({ where: { pageId } });
  const tab = await prisma.pageTab.create({
    data: {
      pageId,
      name: name?.trim() || `Tab ${count + 1}`,
      sortOrder: count,
    },
  });
  if (count >= 1) {
    await prisma.page.update({
      where: { id: pageId },
      data: { showTabs: true },
    });
  }
  return tab;
}

export async function updateTab(tabId: string, data: { name: string }) {
  return prisma.pageTab.update({
    where: { id: tabId },
    data: { name: data.name.trim() || "Tab" },
  });
}

export async function reorderTabs(pageId: string, tabIds: string[]) {
  await prisma.$transaction(
    tabIds.map((id, index) =>
      prisma.pageTab.update({
        where: { id },
        data: { sortOrder: index },
      }),
    ),
  );
}

export async function deleteTab(tabId: string) {
  const tab = await prisma.pageTab.findUnique({
    where: { id: tabId },
    select: { id: true, pageId: true },
  });
  if (!tab) throw new Error("That tab no longer exists.");

  const count = await prisma.pageTab.count({ where: { pageId: tab.pageId } });
  if (count <= 1) throw new Error("A page needs at least one tab.");

  await prisma.pageTab.delete({ where: { id: tabId } });

  const remaining = await prisma.pageTab.count({
    where: { pageId: tab.pageId },
  });
  if (remaining <= 1) {
    await prisma.page.update({
      where: { id: tab.pageId },
      data: { showTabs: false },
    });
  }
}

export async function createMenuItem(
  menuId: string,
  input: { label: string; pageId?: string | null; parentId?: string | null },
) {
  const count = await prisma.siteMenuItem.count({
    where: { menuId, parentId: input.parentId ?? null },
  });
  return prisma.siteMenuItem.create({
    data: {
      menuId,
      label: input.label.trim() || "Link",
      pageId: input.pageId ?? null,
      parentId: input.parentId ?? null,
      sortOrder: count,
    },
  });
}

export async function updateMenuItem(
  itemId: string,
  data: {
    label?: string;
    pageId?: string | null;
    parentId?: string | null;
  },
) {
  return prisma.siteMenuItem.update({
    where: { id: itemId },
    data: {
      label: data.label?.trim(),
      pageId: data.pageId,
      parentId: data.parentId,
    },
  });
}

export async function reorderMenuItems(itemIds: string[]) {
  await prisma.$transaction(
    itemIds.map((id, index) =>
      prisma.siteMenuItem.update({
        where: { id },
        data: { sortOrder: index },
      }),
    ),
  );
}

export async function deleteMenuItem(itemId: string) {
  await prisma.siteMenuItem.updateMany({
    where: { parentId: itemId },
    data: { parentId: null },
  });
  await prisma.siteMenuItem.delete({ where: { id: itemId } });
}

export async function instantiateTemplate(
  templateKey: string,
  input: {
    name?: string;
    description?: string;
    connectionId?: string | null;
    slug?: string;
    isDefault?: boolean;
  },
) {
  const template = getSiteTemplate(templateKey);
  if (!template) throw new Error("Unknown template.");

  let objectIds = new Map<string, string>();
  if (template.createsCampaignObjects && input.connectionId) {
    objectIds = await createCampaignObjects(input.connectionId);
  } else if (input.connectionId) {
    objectIds = await mapObjectsOnConnection(input.connectionId);
  }

  const dashboard = await createDashboard({
    name: input.name?.trim() || template.name,
    description: input.description?.trim() || template.description,
    connectionId: input.connectionId ?? null,
    slug: input.slug,
    isDefault: input.isDefault,
    withDefaultFilters: template.withDefaultFilters !== false && !template.filters,
  });

  if (template.filters?.length) {
    await prisma.globalFilter.createMany({
      data: template.filters.map((filter, index) => ({
        dashboardId: dashboard.id,
        key: filter.key,
        label: filter.label,
        kind: filter.kind,
        defaultValue: (filter.defaultValue ?? null) as Prisma.InputJsonValue,
        options: (filter.options ?? {}) as Prisma.InputJsonValue,
        sortOrder: filter.sortOrder ?? index,
      })),
    });
  }

  await prisma.page.deleteMany({ where: { dashboardId: dashboard.id } });
  await prisma.siteMenu.deleteMany({ where: { dashboardId: dashboard.id } });

  const pageIdBySlug = new Map<string, string>();
  const widgetIdByKey = new Map<string, string>();
  const pendingLinks: { widgetKey: string; linkedToKey: string }[] = [];

  for (const [pageIndex, pageDef] of template.pages.entries()) {
    const page = await prisma.page.create({
      data: {
        dashboardId: dashboard.id,
        name: pageDef.name,
        slug: pageDef.slug,
        sortOrder: pageIndex,
        isHome: pageDef.isHome ?? pageIndex === 0,
        showTabs: pageDef.showTabs ?? pageDef.tabs.length > 1,
      },
    });
    pageIdBySlug.set(page.slug, page.id);

    for (const [tabIndex, tabDef] of pageDef.tabs.entries()) {
      const tab = await prisma.pageTab.create({
        data: {
          pageId: page.id,
          name: tabDef.name,
          sortOrder: tabIndex,
        },
      });

      for (const widgetDef of tabDef.widgets) {
        const created = await createTemplateWidget(
          dashboard.id,
          tab.id,
          widgetDef,
          objectIds,
        );
        if (!created) continue;
        widgetIdByKey.set(widgetDef.key, created.id);
        if (widgetDef.blockKind === "object" && widgetDef.linkedToKey) {
          pendingLinks.push({
            widgetKey: widgetDef.key,
            linkedToKey: widgetDef.linkedToKey,
          });
        }
      }
    }
  }

  for (const link of pendingLinks) {
    const widgetId = widgetIdByKey.get(link.widgetKey);
    const linkedWidgetId = widgetIdByKey.get(link.linkedToKey);
    if (!widgetId || !linkedWidgetId) continue;
    await prisma.dashboardWidget.update({
      where: { id: widgetId },
      data: { linkedWidgetId },
    });
  }

  const menu = await prisma.siteMenu.create({
    data: { dashboardId: dashboard.id, location: "header" },
  });

  for (const [index, item] of template.menu.entries()) {
    const parent = await prisma.siteMenuItem.create({
      data: {
        menuId: menu.id,
        label: item.label,
        pageId: pageIdBySlug.get(item.pageSlug) ?? null,
        sortOrder: index,
      },
    });
    if (!item.children?.length) continue;
    for (const [childIndex, child] of item.children.entries()) {
      await prisma.siteMenuItem.create({
        data: {
          menuId: menu.id,
          parentId: parent.id,
          label: child.label,
          pageId: pageIdBySlug.get(child.pageSlug) ?? null,
          sortOrder: childIndex,
        },
      });
    }
  }

  return dashboard;
}

async function mapObjectsOnConnection(connectionId: string) {
  const objects = await prisma.dataObject.findMany({
    where: { connectionId },
    select: { id: true, name: true, kind: true },
    orderBy: { createdAt: "asc" },
  });
  const map = new Map<string, string>();
  for (const object of objects) {
    map.set(object.name, object.id);
    if (!map.has(object.kind)) map.set(object.kind, object.id);
  }
  return map;
}

async function createTemplateWidget(
  dashboardId: string,
  tabId: string,
  def: TemplateWidget,
  objectIds: Map<string, string>,
) {
  if (def.blockKind !== "object") {
    return prisma.dashboardWidget.create({
      data: {
        dashboardId,
        tabId,
        title: def.title ?? null,
        blockKind: def.blockKind,
        blockConfig: def.blockConfig as Prisma.InputJsonValue,
        ...def.layout,
      },
    });
  }

  const objectId =
    objectIds.get(def.objectKey ?? "") ??
    objectIds.get(def.title ?? "") ??
    null;
  if (!objectId) return null;

  return prisma.dashboardWidget.create({
    data: {
      dashboardId,
      tabId,
      dataObjectId: objectId,
      title: def.title ?? null,
      blockKind: "object" satisfies BlockKind,
      ...def.layout,
    },
  });
}
