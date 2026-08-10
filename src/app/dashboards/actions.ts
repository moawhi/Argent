"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import {
  addWidget,
  createDashboard,
  saveLayout,
} from "@/server/dashboards/service";
import type { Prisma } from "@prisma/client";
import { requireAdmin, requireSection } from "@/server/auth/permissions";
import { setDashboardAccess } from "@/server/auth/users";
import { isDemoDashboardSlug } from "@/server/demo/access";

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export async function createDashboardAction(input: {
  name: string;
  connectionId?: string | null;
  description?: string;
}): Promise<{ ok: boolean; id?: string; slug?: string; error?: string }> {
  try {
    await requireSection("dashboards");
    const dashboard = await createDashboard(input);
    revalidatePath("/dashboards");
    revalidatePath("/");
    return { ok: true, id: dashboard.id, slug: dashboard.slug };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

export async function addWidgetAction(
  dashboardId: string,
  dataObjectId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await addWidget(dashboardId, dataObjectId);
    revalidatePath(`/dashboards/${dashboardId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

export async function removeWidgetAction(
  widgetId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const widget = await prisma.dashboardWidget.delete({
      where: { id: widgetId },
      select: { dashboardId: true },
    });
    revalidatePath(`/dashboards/${widget.dashboardId}`);
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
    const widget = await prisma.dashboardWidget.update({
      where: { id: widgetId },
      data,
      select: { dashboardId: true },
    });
    revalidatePath(`/dashboards/${widget.dashboardId}`);
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
  },
): Promise<{ ok: boolean; error?: string }> {
  try {
    await prisma.dashboard.update({ where: { id: dashboardId }, data });
    revalidatePath(`/dashboards/${dashboardId}`);
    revalidatePath("/dashboards");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}

export async function deleteDashboardAction(
  dashboardId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireSection("dashboards");
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

    revalidatePath(`/dashboards/${dashboardId}`);
    return { ok: true };
  } catch (error) {
    const message = describeError(error);
    if (message.toLowerCase().includes("unique")) {
      return {
        ok: false,
        error: "That parameter name is already used on this dashboard.",
      };
    }
    return { ok: false, error: message };
  }
}

export async function deleteFilterAction(
  filterId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const filter = await prisma.globalFilter.delete({
      where: { id: filterId },
      select: { dashboardId: true },
    });
    revalidatePath(`/dashboards/${filter.dashboardId}`);
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
    revalidatePath("/dashboards");
    revalidatePath(`/dashboards/${dashboardId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: describeError(error) };
  }
}
