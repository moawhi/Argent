import "server-only";

import { prisma } from "@/server/db";
import { buildRowActionTarget } from "@/server/objects/service";
import type { RowAction, RowActionInput } from "@/lib/objects/types";
import type { Prisma } from "@prisma/client";

const DATE_BINDINGS = {
  fromDate: { mode: "filter", filterKey: "dateRange.from" },
  toDate: { mode: "filter", filterKey: "dateRange.to" },
  timezone: { mode: "filter", filterKey: "timezone" },
} as const;

type SeedRowAction = Omit<RowAction, "operationId" | "method" | "formFields"> & {
  operationKey?: string;
};

const BY_ROW_ID: RowActionInput[] = [
  { target: "id", source: "row", field: "id" },
];

function rowAction(
  action: Partial<SeedRowAction> & { id: string },
): SeedRowAction {
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
}

function kpi(
  key: string,
  name: string,
  field: string,
  format: string,
  accent: string,
  caption: string,
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
  };
}

function campaignObjectDefs(): SeedObject[] {
  return [
    kpi("kpiRevenue", "Revenue", "totalRevenue", "currency", "brand", "Across every campaign"),
    kpi("kpiSpend", "Ad spend", "totalSpend", "currency", "neutral", "What was paid out to run the ads"),
    kpi("kpiConversions", "Conversions", "totalConversions", "number", "positive", "Completed sign-ups and sales"),
    kpi("kpiRoas", "Return on ad spend", "returnOnAdSpend", "number", "warning", "Revenue for every dollar spent"),
    {
      key: "chartRevenue",
      operationKey: "getDailyStats",
      name: "Revenue and spend over time",
      description: "Daily revenue against what it cost to earn it.",
      kind: "chart",
      config: {
        xField: "date",
        series: [
          { path: "revenue", label: "Revenue", type: "area", axis: "left", color: "#3b6ef6", format: "currency" },
          { path: "spend", label: "Ad spend", type: "line", axis: "left", color: "#f59e0b", format: "currency" },
        ],
        showZoom: true,
        stacked: false,
        smooth: true,
        legend: true,
        sortByX: true,
      },
      paramBindings: { ...DATE_BINDINGS, groupBy: { mode: "static", value: "day" } },
    },
    {
      key: "chartConversions",
      operationKey: "getDailyStats",
      name: "Clicks and conversions",
      description: "How many people clicked an ad, and how many of them went on to convert.",
      kind: "chart",
      config: {
        xField: "date",
        series: [
          { path: "clicks", label: "Clicks", type: "bar", axis: "left", color: "#94a3b8", format: "number" },
          { path: "conversions", label: "Conversions", type: "line", axis: "right", color: "#16a34a", format: "number" },
        ],
        showZoom: true,
        stacked: false,
        smooth: false,
        legend: true,
        sortByX: true,
      },
      paramBindings: { ...DATE_BINDINGS, groupBy: { mode: "static", value: "day" } },
    },
    {
      key: "chartCampaignPie",
      operationKey: "getCampaignStats",
      name: "Conversions by campaign",
      description: "Which campaigns drove the most conversions in this period.",
      kind: "chart",
      config: {
        xField: "name",
        series: [
          { path: "conversions", label: "Conversions", type: "pie", axis: "left", color: "#3b6ef6", format: "number" },
        ],
        showZoom: false,
        stacked: false,
        smooth: false,
        legend: true,
        sortByX: false,
        fetchLimit: 10,
      },
      paramBindings: { ...DATE_BINDINGS, limit: { mode: "static", value: 10 } },
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
          { path: "totalSpend", label: "Spend", type: "doughnut", axis: "left", color: "#f59e0b", format: "currency" },
        ],
        showZoom: false,
        stacked: false,
        smooth: false,
        legend: true,
        sortByX: false,
        fetchLimit: 20,
      },
      paramBindings: { limit: { mode: "static", value: 20 } },
    },
    {
      key: "chartRates",
      operationKey: "getDailyStats",
      name: "Click rate and conversion rate",
      description: "How often ads are clicked, and how often those clicks convert.",
      kind: "chart",
      config: {
        xField: "date",
        series: [
          { path: "clickThroughRate", label: "Click rate", type: "line", axis: "left", color: "#8b5cf6", format: "percent" },
          { path: "conversionRate", label: "Conversion rate", type: "line", axis: "right", color: "#16a34a", format: "percent" },
        ],
        showZoom: true,
        stacked: false,
        smooth: true,
        legend: true,
        sortByX: true,
      },
      paramBindings: { ...DATE_BINDINGS, groupBy: { mode: "static", value: "day" } },
    },
    {
      key: "chartCommission",
      operationKey: "getDailyCommission",
      name: "Commission over time",
      description: "Daily commission earned against the revenue that generated it.",
      kind: "chart",
      config: {
        xField: "date",
        series: [
          { path: "commissionAmount", label: "Commission", type: "area", axis: "left", color: "#0ea5e9", format: "currency" },
          { path: "revenue", label: "Revenue", type: "line", axis: "right", color: "#64748b", format: "currency" },
        ],
        showZoom: true,
        stacked: false,
        smooth: true,
        legend: true,
        sortByX: true,
      },
      paramBindings: { ...DATE_BINDINGS, groupBy: { mode: "static", value: "day" } },
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
          { path: "totalSpend", label: "Spend", type: "bar", axis: "left", color: "#f59e0b", format: "currency" },
          { path: "conversions", label: "Conversions", type: "line", axis: "right", color: "#16a34a", format: "number" },
        ],
        showZoom: false,
        stacked: false,
        smooth: false,
        legend: true,
        sortByX: false,
        fetchLimit: 12,
      },
      paramBindings: { ...DATE_BINDINGS, limit: { mode: "static", value: 12 } },
    },
    {
      key: "tableGroups",
      operationKey: "listCampaignGroups",
      name: "Campaign groups",
      description: "Every campaign group. Select a row to load it into the form beside this table.",
      kind: "table",
      config: {
        columns: [
          { path: "name", label: "Name", visible: true, format: "text" },
          { path: "status", label: "Status", visible: true, format: "badge" },
          { path: "monthlyBudget", label: "Monthly budget", visible: true, format: "currency", align: "right" },
          { path: "totalSpend", label: "Spent", visible: true, format: "currency", align: "right" },
          { path: "campaignCount", label: "Campaigns", visible: true, format: "number", align: "right" },
          { path: "ownerEmail", label: "Owner", visible: true, format: "text" },
          { path: "createdAt", label: "Created", visible: false, format: "date" },
        ],
        pageSize: 10,
        searchable: true,
        rowIdField: "id",
        rowActions: [
          rowAction({ id: "group-view", kind: "details", label: "View details", icon: "view", operationKey: "getCampaignGroup" }),
          rowAction({ id: "group-campaigns", kind: "details", label: "Campaigns in this group", icon: "transfer", operationKey: "listGroupCampaigns" }),
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
    },
    {
      key: "formGroup",
      operationKey: "updateCampaignGroup",
      name: "Update a campaign group",
      description: "Select a row in the table to edit it here.",
      kind: "form",
      config: {
        fields: [
          { path: "name", label: "Name", control: "text", visible: true, required: true, helpText: "A short, recognisable name." },
          { path: "description", label: "Description", control: "textarea", visible: true, required: false, helpText: "What this group of campaigns is for." },
          { path: "status", label: "Status", control: "select", visible: true, required: false, options: ["active", "paused", "archived"] },
          { path: "monthlyBudget", label: "Monthly budget", control: "number", visible: true, required: false, min: 0, helpText: "Spend cap for the whole group, per month." },
          { path: "ownerEmail", label: "Owner email", control: "text", visible: true, required: false, placeholder: "someone@example.com" },
        ],
        submitLabel: "Save changes",
        successMessage: "Campaign group updated.",
        layout: "single",
      },
      paramBindings: { id: { mode: "selection", field: "id" } },
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
          { path: "impressions", label: "Impressions", visible: true, format: "number", align: "right" },
          { path: "clicks", label: "Clicks", visible: true, format: "number", align: "right" },
          { path: "clickThroughRate", label: "Click rate", visible: true, format: "percent", align: "right" },
          { path: "conversions", label: "Conversions", visible: true, format: "number", align: "right" },
          { path: "totalSpend", label: "Spend", visible: true, format: "currency", align: "right" },
          { path: "dailyBudget", label: "Daily budget", visible: false, format: "currency", align: "right" },
          { path: "landingPageUrl", label: "Landing page", visible: false, format: "link" },
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
      paramBindings: { ...DATE_BINDINGS, limit: { mode: "static", value: 40 } },
    },
  ];
}

async function resolveActionList(
  actions: SeedRowAction[] | undefined,
  operationByKey: Map<string, string>,
): Promise<RowAction[]> {
  if (!actions?.length) return [];
  const resolved: RowAction[] = [];
  for (const { operationKey, ...action } of actions) {
    const operationId = operationKey ? operationByKey.get(operationKey) : undefined;
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
    toolbarActions: await resolveActionList(table.toolbarActions, operationByKey),
  };
}

/** Create (or reuse) the Campaign hub data objects on a connection. */
export async function createCampaignObjects(
  connectionId: string,
): Promise<Map<string, string>> {
  const operations = await prisma.operation.findMany({
    where: { connectionId },
    select: { id: true, operationKey: true },
  });
  const operationByKey = new Map(
    operations.map((operation) => [operation.operationKey, operation.id]),
  );

  const existing = await prisma.dataObject.findMany({
    where: { connectionId },
    select: { id: true, name: true },
  });
  const existingByName = new Map(existing.map((row) => [row.name, row.id]));

  const objectIdByKey = new Map<string, string>();

  for (const definition of campaignObjectDefs()) {
    if (!operationByKey.has(definition.operationKey)) continue;

    const already = existingByName.get(definition.name);
    if (already) {
      objectIdByKey.set(definition.key, already);
      continue;
    }

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

  return objectIdByKey;
}
