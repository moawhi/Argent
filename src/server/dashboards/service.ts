import "server-only";

import { prisma } from "@/server/db";
import { daysAgo, isoDate, slugify } from "@/lib/utils";
import { OBJECT_KIND_SIZE, type ObjectKind } from "@/lib/objects/types";
import type { Prisma } from "@prisma/client";

export interface FilterDefinition {
  id: string;
  key: string;
  label: string;
  kind: string;
  defaultValue: unknown;
  options: unknown;
  sortOrder: number;
}

export interface WidgetView {
  id: string;
  title: string | null;
  x: number;
  y: number;
  w: number;
  h: number;
  linkedWidgetId: string | null;
  object: {
    id: string;
    name: string;
    kind: ObjectKind;
    config: unknown;
    connectionId: string;
    connectionReadOnly: boolean;
    operationId: string | null;
    operationKey: string | null;
    method: string | null;
    path: string | null;
  };
}

/** The default filters every new dashboard starts with. */
export const DEFAULT_FILTERS: Omit<FilterDefinition, "id">[] = [
  {
    key: "dateRange",
    label: "Date range",
    kind: "dateRange",
    defaultValue: { from: isoDate(daysAgo(30)), to: isoDate(new Date()) },
    options: { presets: [7, 30, 90] },
    sortOrder: 0,
  },
  {
    key: "timezone",
    label: "Timezone",
    kind: "select",
    defaultValue: "UTC",
    options: {
      values: [
        "UTC",
        "America/New_York",
        "America/Los_Angeles",
        "Europe/London",
        "Australia/Sydney",
      ],
    },
    sortOrder: 1,
  },
];

export async function listDashboards() {
  return prisma.dashboard.findMany({
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    include: {
      connection: { select: { id: true, name: true } },
      _count: { select: { widgets: true } },
    },
  });
}

export async function getDashboard(idOrSlug: string) {
  const dashboard = await prisma.dashboard.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    include: {
      filters: { orderBy: { sortOrder: "asc" } },
      widgets: {
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
      },
    },
  });

  if (!dashboard) return null;

  const widgets: WidgetView[] = dashboard.widgets.map((widget) => ({
    id: widget.id,
    title: widget.title,
    x: widget.x,
    y: widget.y,
    w: widget.w,
    h: widget.h,
    linkedWidgetId: widget.linkedWidgetId,
    object: {
      id: widget.dataObject.id,
      name: widget.dataObject.name,
      kind: widget.dataObject.kind as ObjectKind,
      config: widget.dataObject.config,
      connectionId: widget.dataObject.connectionId,
      connectionReadOnly: widget.dataObject.connection.readOnly,
      operationId: widget.dataObject.operation?.id ?? null,
      operationKey: widget.dataObject.operation?.operationKey ?? null,
      method: widget.dataObject.operation?.method ?? null,
      path: widget.dataObject.operation?.path ?? null,
    },
  }));

  return {
    id: dashboard.id,
    name: dashboard.name,
    slug: dashboard.slug,
    description: dashboard.description,
    connectionId: dashboard.connectionId,
    filtersVisible: dashboard.filtersVisible,
    filters: dashboard.filters.map((filter) => ({
      id: filter.id,
      key: filter.key,
      label: filter.label,
      kind: filter.kind,
      defaultValue: filter.defaultValue,
      options: filter.options,
      sortOrder: filter.sortOrder,
    })) as FilterDefinition[],
    widgets,
  };
}

async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base) || "dashboard";
  let candidate = root;
  let suffix = 2;

  while (await prisma.dashboard.findUnique({ where: { slug: candidate } })) {
    candidate = `${root}-${suffix++}`;
  }

  return candidate;
}

export async function createDashboard(input: {
  name: string;
  connectionId?: string | null;
  description?: string;
  withDefaultFilters?: boolean;
}) {
  return prisma.dashboard.create({
    data: {
      name: input.name.trim() || "Untitled dashboard",
      slug: await uniqueSlug(input.name),
      description: input.description?.trim() || null,
      connectionId: input.connectionId ?? null,
      filters:
        input.withDefaultFilters === false
          ? undefined
          : {
              create: DEFAULT_FILTERS.map((filter) => ({
                key: filter.key,
                label: filter.label,
                kind: filter.kind,
                defaultValue: filter.defaultValue as Prisma.InputJsonValue,
                options: filter.options as Prisma.InputJsonValue,
                sortOrder: filter.sortOrder,
              })),
            },
    },
  });
}

/**
 * Places a new widget in the first free row so it never lands on top of an
 * existing one.
 */
export async function addWidget(dashboardId: string, dataObjectId: string) {
  const [object, existing] = await Promise.all([
    prisma.dataObject.findUnique({
      where: { id: dataObjectId },
      select: { kind: true, name: true },
    }),
    prisma.dashboardWidget.findMany({
      where: { dashboardId },
      select: { x: true, y: true, w: true, h: true },
    }),
  ]);

  if (!object) throw new Error("That object no longer exists.");

  const size = OBJECT_KIND_SIZE[object.kind as ObjectKind] ?? { w: 6, h: 8 };
  const bottom = existing.reduce(
    (max, widget) => Math.max(max, widget.y + widget.h),
    0,
  );

  // KPI cards tile along the top row; everything else starts a new row.
  const sameRow =
    object.kind === "kpi"
      ? existing.filter((widget) => widget.y === 0 && widget.h <= size.h)
      : [];
  const usedWidth = sameRow.reduce((total, widget) => total + widget.w, 0);
  const fitsTopRow = object.kind === "kpi" && usedWidth + size.w <= 12;

  return prisma.dashboardWidget.create({
    data: {
      dashboardId,
      dataObjectId,
      x: fitsTopRow ? usedWidth : 0,
      y: fitsTopRow ? 0 : bottom,
      w: size.w,
      h: size.h,
    },
  });
}

export async function saveLayout(
  dashboardId: string,
  layout: { id: string; x: number; y: number; w: number; h: number }[],
) {
  await prisma.$transaction(
    layout.map((item) =>
      prisma.dashboardWidget.update({
        where: { id: item.id },
        data: { x: item.x, y: item.y, w: item.w, h: item.h },
      }),
    ),
  );
}
