import "server-only";

import { prisma } from "@/server/db";
import { daysAgo, isoDate, slugify } from "@/lib/utils";
import { OBJECT_KIND_SIZE, type ObjectKind } from "@/lib/objects/types";
import {
  BLOCK_KIND_SIZE,
  defaultBlockConfig,
  type BlockKind,
} from "@/lib/sites/types";
import { backfillAllSites, ensureSiteStructure } from "@/server/sites/backfill";
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
  blockKind: BlockKind;
  blockConfig: unknown;
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
  } | null;
}

export interface PageSummary {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  isHome: boolean;
  showTabs: boolean;
  tabs: { id: string; name: string; sortOrder: number }[];
}

export interface MenuItemView {
  id: string;
  label: string;
  pageId: string | null;
  pageSlug: string | null;
  sortOrder: number;
  children: MenuItemView[];
}

/** The default filters every new site starts with. */
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

const widgetInclude = {
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
} as const;

export function toWidgetView(widget: {
  id: string;
  title: string | null;
  x: number;
  y: number;
  w: number;
  h: number;
  linkedWidgetId: string | null;
  blockKind: string;
  blockConfig: unknown;
  dataObject: {
    id: string;
    name: string;
    kind: string;
    config: unknown;
    connectionId: string;
    connection: { id: string; readOnly: boolean };
    operation: {
      id: string;
      operationKey: string;
      method: string;
      path: string;
    } | null;
  } | null;
}): WidgetView {
  return {
    id: widget.id,
    title: widget.title,
    x: widget.x,
    y: widget.y,
    w: widget.w,
    h: widget.h,
    linkedWidgetId: widget.linkedWidgetId,
    blockKind: (widget.blockKind as BlockKind) || "object",
    blockConfig: widget.blockConfig,
    object: widget.dataObject
      ? {
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
        }
      : null,
  };
}

export async function listDashboards() {
  await backfillAllSites();
  return prisma.dashboard.findMany({
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    include: {
      connection: { select: { id: true, name: true } },
      _count: { select: { widgets: true, pages: true } },
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
        include: widgetInclude,
      },
    },
  });

  if (!dashboard) return null;
  await ensureSiteStructure(dashboard.id);

  const widgets: WidgetView[] = dashboard.widgets.map(toWidgetView);

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
  const root = slugify(base) || "site";
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
  slug?: string;
  isDefault?: boolean;
}) {
  const dashboard = await prisma.dashboard.create({
    data: {
      name: input.name.trim() || "Untitled site",
      slug: input.slug ?? (await uniqueSlug(input.name)),
      description: input.description?.trim() || null,
      connectionId: input.connectionId ?? null,
      isDefault: input.isDefault ?? false,
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

  await ensureSiteStructure(dashboard.id);
  return dashboard;
}

/**
 * Places a new widget on a tab in the first free row.
 */
export async function addWidget(
  tabId: string,
  input:
    | { dataObjectId: string }
    | { blockKind: Exclude<BlockKind, "object">; blockConfig?: unknown },
) {
  const tab = await prisma.pageTab.findUnique({
    where: { id: tabId },
    include: { page: { select: { dashboardId: true } } },
  });
  if (!tab) throw new Error("That page tab no longer exists.");

  const dashboardId = tab.page.dashboardId;
  const existing = await prisma.dashboardWidget.findMany({
    where: { tabId },
    select: { x: true, y: true, w: true, h: true },
  });

  let size = BLOCK_KIND_SIZE.object;
  let data: Prisma.DashboardWidgetCreateInput;

  if ("dataObjectId" in input) {
    const object = await prisma.dataObject.findUnique({
      where: { id: input.dataObjectId },
      select: { kind: true, name: true },
    });
    if (!object) throw new Error("That object no longer exists.");
    size = OBJECT_KIND_SIZE[object.kind as ObjectKind] ?? { w: 6, h: 8 };

    const bottom = existing.reduce(
      (max, widget) => Math.max(max, widget.y + widget.h),
      0,
    );
    const sameRow =
      object.kind === "kpi"
        ? existing.filter((widget) => widget.y === 0 && widget.h <= size.h)
        : [];
    const usedWidth = sameRow.reduce((total, widget) => total + widget.w, 0);
    const fitsTopRow = object.kind === "kpi" && usedWidth + size.w <= 12;

    data = {
      dashboard: { connect: { id: dashboardId } },
      tab: { connect: { id: tabId } },
      dataObject: { connect: { id: input.dataObjectId } },
      blockKind: "object",
      x: fitsTopRow ? usedWidth : 0,
      y: fitsTopRow ? 0 : bottom,
      w: size.w,
      h: size.h,
    };
  } else {
    size = BLOCK_KIND_SIZE[input.blockKind];
    const bottom = existing.reduce(
      (max, widget) => Math.max(max, widget.y + widget.h),
      0,
    );
    data = {
      dashboard: { connect: { id: dashboardId } },
      tab: { connect: { id: tabId } },
      blockKind: input.blockKind,
      blockConfig: (input.blockConfig ??
        defaultBlockConfig(input.blockKind)) as Prisma.InputJsonValue,
      x: 0,
      y: bottom,
      w: size.w,
      h: size.h,
    };
  }

  return prisma.dashboardWidget.create({ data });
}

export async function saveLayout(
  _dashboardId: string,
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
