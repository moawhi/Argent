"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import {
  addWidget,
  createDashboard,
  saveLayout,
} from "@/server/dashboards/service";
import {
  createMenuItem,
  createPage,
  createTab,
  deleteMenuItem,
  deletePage,
  deleteTab,
  instantiateTemplate,
  reorderMenuItems,
  reorderPages,
  reorderTabs,
  updateMenuItem,
  updatePage,
  updateTab,
} from "@/server/sites/service";
import { ensureSiteEditor } from "@/server/auth/permissions";
import type { BlockKind } from "@/lib/sites/types";
import type { Prisma } from "@prisma/client";

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

async function revalidateSite(dashboardId: string) {
  const dashboard = await prisma.dashboard.findUnique({
    where: { id: dashboardId },
    select: { slug: true },
  });
  revalidatePath("/sites");
  revalidatePath("/dashboards");
  revalidatePath("/");
  if (dashboard) {
    revalidatePath(`/sites/${dashboard.slug}`);
    revalidatePath(`/dashboards/${dashboard.slug}`);
    revalidatePath(`/view/${dashboard.slug}`);
  }
}

export async function createSiteAction(input: {
  name: string;
  connectionId?: string | null;
  description?: string;
  templateKey?: string;
}): Promise<{ ok: boolean; id?: string; slug?: string; error?: string }> {
  try {
    await ensureSiteEditor();
    const site = input.templateKey
      ? await instantiateTemplate(input.templateKey, {
          name: input.name,
          description: input.description,
          connectionId: input.connectionId ?? null,
        })
      : await createDashboard({
          name: input.name,
          description: input.description,
          connectionId: input.connectionId ?? null,
        });
    await revalidateSite(site.id);
    return { ok: true, id: site.id, slug: site.slug };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

export async function setSitePublishedAction(
  dashboardId: string,
  published: boolean,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await ensureSiteEditor();
    await prisma.dashboard.update({
      where: { id: dashboardId },
      data: {
        published,
        publishedAt: published ? new Date() : null,
      },
    });
    await revalidateSite(dashboardId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

export async function addObjectWidgetAction(
  tabId: string,
  dataObjectId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await ensureSiteEditor();
    const widget = await addWidget(tabId, { dataObjectId });
    await revalidateSite(widget.dashboardId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

export async function addContentWidgetAction(
  tabId: string,
  blockKind: Exclude<BlockKind, "object">,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await ensureSiteEditor();
    const widget = await addWidget(tabId, { blockKind });
    await revalidateSite(widget.dashboardId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

export async function createPageAction(
  dashboardId: string,
  name: string,
): Promise<{ ok: boolean; error?: string; slug?: string }> {
  try {
    await ensureSiteEditor();
    const page = await createPage(dashboardId, { name });
    await revalidateSite(dashboardId);
    return { ok: true, slug: page.slug };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

export async function updatePageAction(
  dashboardId: string,
  pageId: string,
  data: { name?: string; slug?: string; isHome?: boolean; showTabs?: boolean },
): Promise<{ ok: boolean; error?: string }> {
  try {
    await ensureSiteEditor();
    await updatePage(pageId, data);
    await revalidateSite(dashboardId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

export async function reorderPagesAction(
  dashboardId: string,
  pageIds: string[],
): Promise<{ ok: boolean; error?: string }> {
  try {
    await ensureSiteEditor();
    await reorderPages(dashboardId, pageIds);
    await revalidateSite(dashboardId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

export async function deletePageAction(
  dashboardId: string,
  pageId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await ensureSiteEditor();
    await deletePage(pageId);
    await revalidateSite(dashboardId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

export async function createTabAction(
  dashboardId: string,
  pageId: string,
  name?: string,
): Promise<{ ok: boolean; error?: string; id?: string }> {
  try {
    await ensureSiteEditor();
    const tab = await createTab(pageId, name);
    await revalidateSite(dashboardId);
    return { ok: true, id: tab.id };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

export async function updateTabAction(
  dashboardId: string,
  tabId: string,
  name: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await ensureSiteEditor();
    await updateTab(tabId, { name });
    await revalidateSite(dashboardId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

export async function reorderTabsAction(
  dashboardId: string,
  pageId: string,
  tabIds: string[],
): Promise<{ ok: boolean; error?: string }> {
  try {
    await ensureSiteEditor();
    await reorderTabs(pageId, tabIds);
    await revalidateSite(dashboardId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

export async function deleteTabAction(
  dashboardId: string,
  tabId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await ensureSiteEditor();
    await deleteTab(tabId);
    await revalidateSite(dashboardId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

export async function createMenuItemAction(
  dashboardId: string,
  menuId: string,
  input: { label: string; pageId?: string | null; parentId?: string | null },
): Promise<{ ok: boolean; error?: string }> {
  try {
    await ensureSiteEditor();
    await createMenuItem(menuId, input);
    await revalidateSite(dashboardId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

export async function updateMenuItemAction(
  dashboardId: string,
  itemId: string,
  data: { label?: string; pageId?: string | null },
): Promise<{ ok: boolean; error?: string }> {
  try {
    await ensureSiteEditor();
    await updateMenuItem(itemId, data);
    await revalidateSite(dashboardId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

export async function reorderMenuItemsAction(
  dashboardId: string,
  itemIds: string[],
): Promise<{ ok: boolean; error?: string }> {
  try {
    await ensureSiteEditor();
    await reorderMenuItems(itemIds);
    await revalidateSite(dashboardId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

export async function deleteMenuItemAction(
  dashboardId: string,
  itemId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await ensureSiteEditor();
    await deleteMenuItem(itemId);
    await revalidateSite(dashboardId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

export async function updateWidgetBlockAction(
  widgetId: string,
  blockConfig: unknown,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await ensureSiteEditor();
    const widget = await prisma.dashboardWidget.update({
      where: { id: widgetId },
      data: { blockConfig: blockConfig as Prisma.InputJsonValue },
      select: { dashboardId: true },
    });
    await revalidateSite(widget.dashboardId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

export async function saveTabLayoutAction(
  dashboardId: string,
  layout: { id: string; x: number; y: number; w: number; h: number }[],
): Promise<{ ok: boolean; error?: string }> {
  try {
    await ensureSiteEditor();
    await saveLayout(dashboardId, layout);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}
