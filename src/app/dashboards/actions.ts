"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { createDashboard, saveLayout } from "@/server/dashboards/service";
import type { Prisma } from "@prisma/client";
import { requireAdmin, ensureSiteEditor } from "@/server/auth/permissions";
import { setDashboardAccess } from "@/server/auth/users";
import { isDemoDashboardSlug } from "@/server/demo/access";

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

async function revalidateSitePaths(dashboardId: string) {
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
    revalidatePath(`/dashboards/${dashboardId}`);
    revalidatePath(`/view/${dashboard.slug}`);
  }
}

export async function createDashboardAction(input: {
  name: string;
  connectionId?: string | null;
  description?: string;
}): Promise<{ ok: boolean; id?: string; slug?: string; error?: string }> {
  try {
    await ensureSiteEditor();
    const dashboard = await createDashboard(input);
    await revalidateSitePaths(dashboard.id);
    return { ok: true, id: dashboard.id, slug: dashboard.slug };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

export async function removeWidgetAction(
  widgetId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await ensureSiteEditor();
    const widget = await prisma.dashboardWidget.delete({
      where: { id: widgetId },
      select: { dashboardId: true },
    });
    await revalidateSitePaths(widget.dashboardId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

export async function saveLayoutAction(
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

export async function updateWidgetAction(
  widgetId: string,
  data: { title?: string | null; linkedWidgetId?: string | null },
): Promise<{ ok: boolean; error?: string }> {
  try {
    await ensureSiteEditor();
    const widget = await prisma.dashboardWidget.update({
      where: { id: widgetId },
      data,
      select: { dashboardId: true },
    });
    await revalidateSitePaths(widget.dashboardId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

export async function updateDashboardAction(
  dashboardId: string,
  data: {
    name?: string;
    description?: string | null;
    filtersVisible?: boolean;
    published?: boolean;
  },
): Promise<{ ok: boolean; error?: string }> {
  try {
    await ensureSiteEditor();
    await prisma.dashboard.update({
      where: { id: dashboardId },
      data: {
        ...data,
        publishedAt:
          data.published === true
            ? new Date()
            : data.published === false
              ? null
              : undefined,
      },
    });
    await revalidateSitePaths(dashboardId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

export async function deleteDashboardAction(
  dashboardId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await ensureSiteEditor();
    const dashboard = await prisma.dashboard.findUnique({
      where: { id: dashboardId },
      select: { id: true, slug: true },
    });
    if (!dashboard) return { ok: false, error: "Dashboard not found." };

    // Only admins may permanently remove the bundled demo dashboard.
    if (isDemoDashboardSlug(dashboard.slug)) {
      await requireAdmin();
    }

    await prisma.dashboard.delete({ where: { id: dashboardId } });
    revalidatePath("/sites");
    revalidatePath("/dashboards");
    revalidatePath("/");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

export async function saveFilterAction(
  dashboardId: string,
  filter: {
    id?: string;
    key: string;
    label: string;
    kind: string;
    defaultValue?: unknown;
    options?: unknown;
    sortOrder?: number;
  },
): Promise<{ ok: boolean; error?: string }> {
  try {
    await ensureSiteEditor();
    const key = filter.key.trim().replace(/\s+/g, "_");
    if (!key) return { ok: false, error: "Parameter name is required." };

    const data = {
      key,
      label: filter.label.trim() || key,
      kind: filter.kind,
      defaultValue: (filter.defaultValue ?? null) as Prisma.InputJsonValue,
      options: (filter.options ?? {}) as Prisma.InputJsonValue,
      sortOrder: filter.sortOrder ?? 0,
    };

    if (filter.id) {
      await prisma.globalFilter.update({
        where: { id: filter.id },
        data,
      });
    } else {
      await prisma.globalFilter.create({
        data: { dashboardId, ...data },
      });
    }

    await revalidateSitePaths(dashboardId);
    return { ok: true };
  } catch (error) {
    const message = describeError(error);
    if (message.toLowerCase().includes("unique")) {
      return {
        ok: false,
        error: "That parameter name is already used on this site.",
      };
    }
    return { ok: false, error: message };
  }
}

export async function deleteFilterAction(
  filterId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await ensureSiteEditor();
    const filter = await prisma.globalFilter.delete({
      where: { id: filterId },
      select: { dashboardId: true },
    });
    await revalidateSitePaths(filter.dashboardId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

export async function saveDashboardAccessAction(
  dashboardId: string,
  input: { roleIds: string[]; userIds: string[] },
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdmin();
    await setDashboardAccess(dashboardId, input);
    await revalidateSitePaths(dashboardId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}
