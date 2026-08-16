import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/server/db";
import {
  createConnectionFromSpec,
  saveCredentials,
} from "@/server/connections/service";
import { createDashboard } from "@/server/dashboards/service";
import { buildRowActionTarget } from "@/server/objects/service";
import { DEMO_CREDENTIALS } from "./data";
import {
  DEMO_CONNECTION_NAME,
  DEMO_DASHBOARD_SLUG,
  demoConnectionNameWhere,
} from "@/server/demo/access";
import { daysAgo, isoDate } from "@/lib/utils";
import type { RowAction, RowActionInput } from "@/lib/objects/types";
import type { Prisma } from "@prisma/client";
import {
  ensureSampleMcpServer,
  SAMPLE_MCP_SLUGS,
} from "@/server/mcp/sample";

export { DEMO_CONNECTION_NAME, DEMO_DASHBOARD_SLUG };

/**
 * The bundled demo points at Argent's own mock sample API, so everything works
 * with no external service. Override with DEMO_API_BASE_URL to aim the same
 * spec at a real server.
 */
function demoBaseUrl(): string {
  return (
    process.env.DEMO_API_BASE_URL ??
    `${process.env.APP_URL ?? "http://localhost:3000"}/api/demo`
  );
}

async function readFixture(): Promise<string> {
  return readFile(path.join(process.cwd(), "fixtures", "demo.yaml"), "utf8");
}

/* ------------------------------------------------------------------ *
 * Object definitions
 * ------------------------------------------------------------------ */

const DATE_BINDINGS = {
  fromDate: { mode: "filter", filterKey: "dateRange.from" },
  toDate: { mode: "filter", filterKey: "dateRange.to" },
  timezone: { mode: "filter", filterKey: "timezone" },
} as const;

/**
 * A row button in the demo. Endpoints are named by their spec key here and
 * swapped for real ids once the spec has been imported.
 */
type SeedRowAction = Omit<RowAction, "operationId" | "method" | "formFields"> & {
  operationKey?: string;
};

/** Sends the row's own id to the endpoint's `id` path parameter. */
const BY_ROW_ID: RowActionInput[] = [
  { target: "id", source: "row", field: "id" },
];

function rowAction(action: Partial<SeedRowAction> & { id: string }): SeedRowAction {
  return {
    kind: "run",
    label: "Run",
    icon: "play",
    danger: false,
    inputs: BY_ROW_ID,
    confirm: false,
    refreshAfter: false,
    ...action,
  };
}

/** The five buttons on the campaigns table, one per HTTP verb it supports. */
function campaignRowActions(): SeedRowAction[] {
  return [
    rowAction({
      id: "campaign-view",
      kind: "details",
      label: "View details",
      icon: "view",
      operationKey: "getCampaign",
    }),
    rowAction({
      id: "campaign-pause",
      kind: "run",
      label: "Pause",
      icon: "pause",
      operationKey: "pauseCampaign",
      confirm: true,
      refreshAfter: true,
      successMessage: "Campaign paused.",
    }),
    rowAction({
      id: "campaign-resume",
      kind: "run",
      label: "Resume",
      icon: "play",
      operationKey: "resumeCampaign",
      confirm: true,
      refreshAfter: true,
      successMessage: "Campaign running again.",
    }),
    rowAction({
      id: "campaign-edit",
      kind: "form",
      label: "Edit",
      icon: "edit",
      operationKey: "updateCampaign",
      refreshAfter: true,
      successMessage: "Campaign updated.",
    }),
    rowAction({
      id: "campaign-delete",
      kind: "run",
      label: "Delete",
      icon: "delete",
      operationKey: "deleteCampaign",
      danger: true,
      confirm: true,
      refreshAfter: true,
      confirmText: "Deleting a campaign cannot be undone. Remove it anyway?",
      successMessage: "Campaign deleted.",
    }),
  ];
}

interface SeedObject {
  key: string;
  operationKey: string;
  name: string;
  description: string;
  kind: string;
  config: unknown;
  paramBindings: Record<string, unknown>;
  /** Grid placement on the demo dashboard. */
  layout: { x: number; y: number; w: number; h: number };
  title?: string;
  /** Key of the table object whose selected row fills this one. */
  linkedTo?: string;
}

function kpi(
  key: string,
  name: string,
  field: string,
  format: string,
  accent: string,
  caption: string,
  x: number,
): SeedObject {
  return {
    key,
    operationKey: "getStatsSummary",
    name,
    description: `Headline ${name.toLowerCase()} for the selected dates.`,
    kind: "kpi",
    config: {
      valueField: field,
      aggregate: "latest",
      format,
      caption,
      compare: "none",
      goodDirection: "up",
      accent,
    },
    paramBindings: { ...DATE_BINDINGS },
    layout: { x, y: 0, w: 3, h: 4 },
  };
}

function seedObjects(): SeedObject[] {
  return [
    kpi(
      "kpiRevenue",
      "Revenue",
      "totalRevenue",
      "currency",
      "brand",
      "Across every campaign",
      0,
    ),
    kpi(
      "kpiSpend",
      "Ad spend",
      "totalSpend",
      "currency",
      "neutral",
      "What was paid out to run the ads",
      3,
    ),
    kpi(
      "kpiConversions",
      "Conversions",
      "totalConversions",
      "number",
      "positive",
      "Completed sign-ups and sales",
      6,
    ),
    kpi(
      "kpiRoas",
      "Return on ad spend",
      "returnOnAdSpend",
      "number",
      "warning",
      "Revenue for every dollar spent",
      9,
    ),

    {
      key: "chartRevenue",
      operationKey: "getDailyStats",
      name: "Revenue and spend over time",
      description:
        "Daily revenue against what it cost to earn it. Drag the slider under the chart to zoom into a shorter window.",
      kind: "chart",
      config: {
        xField: "date",
        series: [
          {
            path: "revenue",
            label: "Revenue",
            type: "area",
            axis: "left",
            color: "#3b6ef6",
            format: "currency",
          },
          {
            path: "spend",
            label: "Ad spend",
            type: "line",
            axis: "left",
            color: "#f59e0b",
            format: "currency",
          },
        ],
        showZoom: true,
        stacked: false,
        smooth: true,
        legend: true,
        sortByX: true,
      },
      paramBindings: {
        ...DATE_BINDINGS,
        groupBy: { mode: "static", value: "day" },
      },
      layout: { x: 0, y: 4, w: 6, h: 10 },
    },

    {
      key: "chartConversions",
      operationKey: "getDailyStats",
      name: "Clicks and conversions",
      description:
        "How many people clicked an ad, and how many of them went on to convert.",
      kind: "chart",
      config: {
        xField: "date",
        series: [
          {
            path: "clicks",
            label: "Clicks",
            type: "bar",
            axis: "left",
            color: "#94a3b8",
            format: "number",
          },
          {
            path: "conversions",
            label: "Conversions",
            type: "line",
            axis: "right",
            color: "#16a34a",
            format: "number",
          },
        ],
        showZoom: true,
        stacked: false,
        smooth: false,
        legend: true,
        sortByX: true,
      },
      paramBindings: {
        ...DATE_BINDINGS,
        groupBy: { mode: "static", value: "day" },
      },
      layout: { x: 6, y: 4, w: 6, h: 10 },
    },

    {
      key: "chartCampaignPie",
      operationKey: "getCampaignStats",
      name: "Conversions by campaign",
      description:
        "Which campaigns drove the most conversions in this period. Slice size is the conversion count.",
      kind: "chart",
      config: {
        xField: "name",
        series: [
          {
            path: "conversions",
            label: "Conversions",
            type: "pie",
            axis: "left",
            color: "#3b6ef6",
            format: "number",
          },
        ],
        showZoom: false,
        stacked: false,
        smooth: false,
        legend: true,
        sortByX: false,
        fetchLimit: 10,
      },
      paramBindings: {
        ...DATE_BINDINGS,
        limit: { mode: "static", value: 10 },
      },
      layout: { x: 0, y: 14, w: 6, h: 10 },
    },

    {
      key: "chartGroupSpend",
      operationKey: "listCampaignGroups",
      name: "Spend by campaign group",
      description: "How ad spend is split across campaign groups right now.",
      kind: "chart",
      config: {
        xField: "name",
        series: [
          {
            path: "totalSpend",
            label: "Spend",
            type: "doughnut",
            axis: "left",
            color: "#f59e0b",
            format: "currency",
          },
        ],
        showZoom: false,
        stacked: false,
        smooth: false,
        legend: true,
        sortByX: false,
        fetchLimit: 20,
      },
      paramBindings: { limit: { mode: "static", value: 20 } },
      layout: { x: 6, y: 14, w: 6, h: 10 },
    },

    {
      key: "chartRates",
      operationKey: "getDailyStats",
      name: "Click rate and conversion rate",
      description:
        "Two efficiency lines over time — how often ads are clicked, and how often those clicks convert.",
      kind: "chart",
      config: {
        xField: "date",
        series: [
          {
            path: "clickThroughRate",
            label: "Click rate",
            type: "line",
            axis: "left",
            color: "#8b5cf6",
            format: "percent",
          },
          {
            path: "conversionRate",
            label: "Conversion rate",
            type: "line",
            axis: "right",
            color: "#16a34a",
            format: "percent",
          },
        ],
        showZoom: true,
        stacked: false,
        smooth: true,
        legend: true,
        sortByX: true,
      },
      paramBindings: {
        ...DATE_BINDINGS,
        groupBy: { mode: "static", value: "day" },
      },
      layout: { x: 0, y: 24, w: 6, h: 10 },
    },

    {
      key: "chartCommission",
      operationKey: "getDailyCommission",
      name: "Commission over time",
      description:
        "Daily commission earned against the revenue that generated it.",
      kind: "chart",
      config: {
        xField: "date",
        series: [
          {
            path: "commissionAmount",
            label: "Commission",
            type: "area",
            axis: "left",
            color: "#0ea5e9",
            format: "currency",
          },
          {
            path: "revenue",
            label: "Revenue",
            type: "line",
            axis: "right",
            color: "#64748b",
            format: "currency",
          },
        ],
        showZoom: true,
        stacked: false,
        smooth: true,
        legend: true,
        sortByX: true,
      },
      paramBindings: {
        ...DATE_BINDINGS,
        groupBy: { mode: "static", value: "day" },
      },
      layout: { x: 6, y: 24, w: 6, h: 10 },
    },

    {
      key: "chartSpendBars",
      operationKey: "getCampaignStats",
      name: "Spend by campaign",
      description: "Side-by-side spend for the top campaigns in the period.",
      kind: "chart",
      config: {
        xField: "name",
        series: [
          {
            path: "totalSpend",
            label: "Spend",
            type: "bar",
            axis: "left",
            color: "#f59e0b",
            format: "currency",
          },
          {
            path: "conversions",
            label: "Conversions",
            type: "line",
            axis: "right",
            color: "#16a34a",
            format: "number",
          },
        ],
        showZoom: false,
        stacked: false,
        smooth: false,
        legend: true,
        sortByX: false,
        fetchLimit: 12,
      },
      paramBindings: {
        ...DATE_BINDINGS,
        limit: { mode: "static", value: 12 },
      },
      layout: { x: 0, y: 34, w: 12, h: 10 },
    },

    {
      key: "tableGroups",
      operationKey: "listCampaignGroups",
      name: "Campaign groups",
      description:
        "Every campaign group. Select a row to load it into the form beside this table.",
      kind: "table",
      config: {
        columns: [
          { path: "name", label: "Name", visible: true, format: "text" },
          { path: "status", label: "Status", visible: true, format: "badge" },
          {
            path: "monthlyBudget",
            label: "Monthly budget",
            visible: true,
            format: "currency",
            align: "right",
          },
          {
            path: "totalSpend",
            label: "Spent",
            visible: true,
            format: "currency",
            align: "right",
          },
          {
            path: "campaignCount",
            label: "Campaigns",
            visible: true,
            format: "number",
            align: "right",
          },
          {
            path: "ownerEmail",
            label: "Owner",
            visible: true,
            format: "text",
          },
          {
            path: "createdAt",
            label: "Created",
            visible: false,
            format: "date",
          },
        ],
        pageSize: 10,
        searchable: true,
        rowIdField: "id",
        // Clicking the row still selects it, so the form beside this table
        // keeps working; the buttons are the way to act on a single group.
        rowActions: [
          rowAction({
            id: "group-view",
            kind: "details",
            label: "View details",
            icon: "view",
            operationKey: "getCampaignGroup",
          }),
          rowAction({
            id: "group-campaigns",
            kind: "details",
            label: "Campaigns in this group",
            icon: "transfer",
            operationKey: "listGroupCampaigns",
          }),
          rowAction({
            id: "group-delete",
            kind: "run",
            label: "Delete",
            icon: "delete",
            operationKey: "deleteCampaignGroup",
            danger: true,
            confirm: true,
            refreshAfter: true,
            successMessage: "Campaign group deleted.",
          }),
        ],
        density: "comfortable",
        emptyMessage: "No campaign groups match this filter.",
      },
      paramBindings: { limit: { mode: "static", value: 100 } },
      layout: { x: 0, y: 44, w: 7, h: 12 },
    },

    {
      key: "formGroup",
      operationKey: "updateCampaignGroup",
      name: "Update a campaign group",
      description:
        "Select a row in the table to edit it here. Built automatically from the endpoint's request body.",
      kind: "form",
      config: {
        fields: [
          {
            path: "name",
            label: "Name",
            control: "text",
            visible: true,
            required: true,
            helpText: "A short, recognisable name.",
          },
          {
            path: "description",
            label: "Description",
            control: "textarea",
            visible: true,
            required: false,
            helpText: "What this group of campaigns is for.",
          },
          {
            path: "status",
            label: "Status",
            control: "select",
            visible: true,
            required: false,
            options: ["active", "paused", "archived"],
          },
          {
            path: "monthlyBudget",
            label: "Monthly budget",
            control: "number",
            visible: true,
            required: false,
            min: 0,
            helpText: "Spend cap for the whole group, per month.",
          },
          {
            path: "ownerEmail",
            label: "Owner email",
            control: "text",
            visible: true,
            required: false,
            placeholder: "someone@example.com",
          },
        ],
        submitLabel: "Save changes",
        successMessage: "Campaign group updated.",
        layout: "single",
      },
      paramBindings: { id: { mode: "selection", field: "id" } },
      layout: { x: 7, y: 44, w: 5, h: 12 },
      linkedTo: "tableGroups",
    },

    {
      key: "tableCampaigns",
      operationKey: "getCampaignStats",
      name: "Campaigns by conversions",
      description: "Every campaign, ordered by how many conversions it drove.",
      kind: "table",
      config: {
        columns: [
          { path: "name", label: "Campaign", visible: true, format: "text" },
          { path: "status", label: "Status", visible: true, format: "badge" },
          {
            path: "impressions",
            label: "Impressions",
            visible: true,
            format: "number",
            align: "right",
          },
          {
            path: "clicks",
            label: "Clicks",
            visible: true,
            format: "number",
            align: "right",
          },
          {
            path: "clickThroughRate",
            label: "Click rate",
            visible: true,
            format: "percent",
            align: "right",
          },
          {
            path: "conversions",
            label: "Conversions",
            visible: true,
            format: "number",
            align: "right",
          },
          {
            path: "totalSpend",
            label: "Spend",
            visible: true,
            format: "currency",
            align: "right",
          },
          {
            path: "dailyBudget",
            label: "Daily budget",
            visible: false,
            format: "currency",
            align: "right",
          },
          {
            path: "landingPageUrl",
            label: "Landing page",
            visible: false,
            format: "link",
          },
        ],
        pageSize: 12,
        searchable: true,
        rowIdField: "id",
        toolbarActions: [
          rowAction({
            id: "campaign-create",
            kind: "form",
            label: "Create",
            icon: "plus",
            operationKey: "createCampaign",
            inputs: [],
            refreshAfter: true,
            successMessage: "Campaign created.",
          }),
        ],
        rowActions: campaignRowActions(),
        rowClickActionId: "campaign-view",
        density: "compact",
        emptyMessage: "No campaigns in this period.",
      },
      paramBindings: {
        ...DATE_BINDINGS,
        limit: { mode: "static", value: 40 },
      },
      layout: { x: 0, y: 56, w: 12, h: 12 },
    },
  ];
}

/* ------------------------------------------------------------------ *
 * Seeding
 * ------------------------------------------------------------------ */

export interface SeedResult {
  connectionId: string;
  dashboardSlug: string;
  operationCount: number;
  objectCount: number;
  alreadyExisted: boolean;
}

/**
 * Swaps the spec-level endpoint names in the seed's row buttons for the ids
 * they were given during import, and generates the boxes an edit button shows.
 */
async function resolveActionList(
  actions: SeedRowAction[] | undefined,
  operationByKey: Map<string, string>,
): Promise<RowAction[]> {
  if (!actions?.length) return [];

  const resolved: RowAction[] = [];

  for (const { operationKey, ...action } of actions) {
    const operationId = operationKey
      ? operationByKey.get(operationKey)
      : undefined;

    // A button pointing at an endpoint the spec no longer has is dropped.
    if (operationKey && !operationId) continue;

    const target = operationId ? await buildRowActionTarget(operationId) : null;

    resolved.push({
      ...action,
      operationId,
      method: target?.method,
      formFields: action.kind === "form" ? target?.formFields : undefined,
    });
  }

  return resolved;
}

async function resolveRowActions(
  config: unknown,
  operationByKey: Map<string, string>,
): Promise<unknown> {
  const table = config as {
    rowActions?: SeedRowAction[];
    toolbarActions?: SeedRowAction[];
  } | null;
  if (!table) return config;
  if (!table.rowActions?.length && !table.toolbarActions?.length) return config;

  return {
    ...table,
    rowActions: await resolveActionList(table.rowActions, operationByKey),
    toolbarActions: await resolveActionList(
      table.toolbarActions,
      operationByKey,
    ),
  };
}

export async function isDemoInstalled(): Promise<boolean> {
  const existing = await prisma.connection.findFirst({
    where: demoConnectionNameWhere(),
    select: { id: true },
  });
  return existing !== null;
}

/** Removes the demo connection and the sample MCP server. */
export async function removeDemo(): Promise<void> {
  const connection = await prisma.connection.findFirst({
    where: demoConnectionNameWhere(),
    select: { id: true },
  });
  if (!connection) return;

  await prisma.mcpServer.deleteMany({
    where: { slug: { in: [...SAMPLE_MCP_SLUGS] } },
  });
  await prisma.dashboard.deleteMany({ where: { connectionId: connection.id } });
  await prisma.connection.delete({ where: { id: connection.id } });
}

/**
 * Installs the bundled sample API: the spec, saved credentials, ready-made
 * objects, a dashboard, and the sample MCP server (slug `sample`).
 *
 * If the demo is already installed, objects and the dashboard layout are
 * rebuilt from the latest seed definitions (connection + credentials stay).
 */
export async function seedDemo(createdById?: string): Promise<SeedResult> {
  const existing = await prisma.connection.findFirst({
    where: demoConnectionNameWhere(),
    include: { _count: { select: { operations: true, dataObjects: true } } },
  });

  let connectionId: string;
  let operationCount: number;
  let objectCount: number;
  let alreadyExisted: boolean;

  if (existing) {
    const rawSpec = await readFixture();
    let slug = existing.slug;
    if (slug.includes("adlogic")) {
      const taken = await prisma.connection.findUnique({
        where: { slug: "sample-api" },
        select: { id: true },
      });
      if (!taken || taken.id === existing.id) slug = "sample-api";
    }
    await prisma.connection.update({
      where: { id: existing.id },
      data: {
        name: DEMO_CONNECTION_NAME,
        slug,
        specTitle: "Sample API",
        rawSpec,
        description:
          "A complete, working example. It talks to a mock sample API built " +
          "into Argent, so nothing leaves this machine.",
      },
    });
    await prisma.docPage.updateMany({
      where: {
        connectionId: existing.id,
        scope: "overview",
        title: "About this demo",
      },
      data: {
        bodyMarkdown:
          "This connection points at a mock sample API bundled with Argent. " +
          "The figures are generated, but everything else — the import, the " +
          "gateway, the objects and the dashboard — is the real thing. Sign in " +
          "details are already saved, so the Try it panel works straight away.",
      },
    });
    const rebuilt = await rebuildDemoDashboard(existing.id);
    connectionId = existing.id;
    operationCount = rebuilt.operationCount;
    objectCount = rebuilt.objectCount;
    alreadyExisted = true;
  } else {
    const rawSpec = await readFixture();

    const { connection } = await createConnectionFromSpec({
      name: DEMO_CONNECTION_NAME,
      rawSpec,
      specFormat: "yaml",
      baseUrl: demoBaseUrl(),
      // The demo API is a local sandbox, so the update form is usable right away.
      readOnly: false,
    });

    await saveCredentials(connection.id, [
      { name: "apiu", in: "query", value: DEMO_CREDENTIALS.apiu },
      { name: "apik", in: "query", value: DEMO_CREDENTIALS.apik },
    ]);

    await prisma.connection.update({
      where: { id: connection.id },
      data: {
        description:
          "A complete, working example. It talks to a mock sample API built " +
          "into Argent, so nothing leaves this machine.",
        variables: { defaultTimezone: "UTC" } as Prisma.InputJsonValue,
      },
    });

    const rebuilt = await rebuildDemoDashboard(connection.id);

    await prisma.docPage.create({
      data: {
        connectionId: connection.id,
        scope: "overview",
        targetKey: "",
        title: "About this demo",
        bodyMarkdown:
          "This connection points at a mock sample API bundled with Argent. " +
          "The figures are generated, but everything else — the import, the " +
          "gateway, the objects and the dashboard — is the real thing. Sign in " +
          "details are already saved, so the Try it panel works straight away.",
      },
    });

    connectionId = connection.id;
    operationCount = rebuilt.operationCount;
    objectCount = rebuilt.objectCount;
    alreadyExisted = false;
  }

  const ownerId =
    createdById ??
    (
      await prisma.user.findFirst({
        where: { role: { key: "admin" }, active: true },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      })
    )?.id;

  if (ownerId) {
    await ensureSampleMcpServer(ownerId);
  }

  return {
    connectionId,
    dashboardSlug: DEMO_DASHBOARD_SLUG,
    operationCount,
    objectCount,
    alreadyExisted,
  };
}

/** Replace demo objects + Campaign performance dashboard from seedObjects(). */
async function rebuildDemoDashboard(
  connectionId: string,
): Promise<{ operationCount: number; objectCount: number }> {
  const operations = await prisma.operation.findMany({
    where: { connectionId },
    select: { id: true, operationKey: true },
  });
  const operationByKey = new Map(
    operations.map((operation) => [operation.operationKey, operation.id]),
  );

  const definitions = seedObjects().filter((definition) =>
    operationByKey.has(definition.operationKey),
  );

  await prisma.dashboard.deleteMany({ where: { connectionId } });
  await prisma.dataObject.deleteMany({ where: { connectionId } });

  const objectIdByKey = new Map<string, string>();
  for (const definition of definitions) {
    const created = await prisma.dataObject.create({
      data: {
        connectionId,
        operationId: operationByKey.get(definition.operationKey)!,
        name: definition.name,
        description: definition.description,
        kind: definition.kind,
        config: (await resolveRowActions(
          definition.config,
          operationByKey,
        )) as Prisma.InputJsonValue,
        paramBindings: definition.paramBindings as Prisma.InputJsonValue,
      },
    });
    objectIdByKey.set(definition.key, created.id);
  }

  const dashboard = await createDashboard({
    name: "Campaign performance",
    connectionId,
    description:
      "Headline numbers, pie and line charts, and the campaign groups behind them.",
    withDefaultFilters: false,
  });

  await prisma.dashboard.update({
    where: { id: dashboard.id },
    data: { slug: DEMO_DASHBOARD_SLUG, isDefault: true },
  });

  await prisma.globalFilter.createMany({
    data: [
      {
        dashboardId: dashboard.id,
        key: "dateRange",
        label: "Date range",
        kind: "dateRange",
        defaultValue: {
          from: isoDate(daysAgo(30)),
          to: isoDate(new Date()),
        } as Prisma.InputJsonValue,
        options: { presets: [7, 30, 90] } as Prisma.InputJsonValue,
        sortOrder: 0,
      },
      {
        dashboardId: dashboard.id,
        key: "timezone",
        label: "Timezone",
        kind: "select",
        defaultValue: "UTC" as Prisma.InputJsonValue,
        options: {
          values: [
            "UTC",
            "Australia/Sydney",
            "America/New_York",
            "Europe/London",
          ],
        } as Prisma.InputJsonValue,
        sortOrder: 1,
      },
    ],
  });

  const widgetIdByKey = new Map<string, string>();
  for (const definition of definitions) {
    const objectId = objectIdByKey.get(definition.key);
    if (!objectId) continue;

    const widget = await prisma.dashboardWidget.create({
      data: {
        dashboardId: dashboard.id,
        dataObjectId: objectId,
        title: definition.title ?? null,
        ...definition.layout,
      },
    });
    widgetIdByKey.set(definition.key, widget.id);
  }

  // Cross-object binding: selecting a group in the table fills the form.
  for (const definition of definitions) {
    if (!definition.linkedTo) continue;
    const widgetId = widgetIdByKey.get(definition.key);
    const linkedWidgetId = widgetIdByKey.get(definition.linkedTo);
    if (!widgetId || !linkedWidgetId) continue;

    await prisma.dashboardWidget.update({
      where: { id: widgetId },
      data: { linkedWidgetId },
    });
  }

  return {
    operationCount: operations.length,
    objectCount: definitions.length,
  };
}
