import type { SiteTemplate } from "@/lib/sites/types";
import { daysAgo, isoDate } from "@/lib/utils";

function obj(
  key: string,
  objectKey: string,
  layout: { x: number; y: number; w: number; h: number },
  linkedToKey?: string,
) {
  return { key, blockKind: "object" as const, objectKey, layout, linkedToKey };
}

export const campaignHubTemplate: SiteTemplate = {
  key: "campaign-hub",
  name: "Campaign hub",
  description:
    "Overview, campaigns and groups — KPIs, charts, tables and a linked edit form.",
  category: "Sample",
  createsCampaignObjects: true,
  withDefaultFilters: false,
  filters: [
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
        values: ["UTC", "Australia/Sydney", "America/New_York", "Europe/London"],
      },
      sortOrder: 1,
    },
  ],
  pages: [
    {
      name: "Overview",
      slug: "overview",
      isHome: true,
      tabs: [
        {
          name: "Main",
          widgets: [
            {
              key: "overviewHeading",
              blockKind: "heading",
              layout: { x: 0, y: 0, w: 12, h: 3 },
              blockConfig: { text: "Campaign performance", level: 1 },
            },
            {
              key: "overviewIntro",
              blockKind: "richtext",
              layout: { x: 0, y: 3, w: 12, h: 3 },
              blockConfig: {
                markdown:
                  "Headline numbers for the selected dates, then the charts behind them. Open **Campaigns** or **Groups** from the menu for tables and edits.",
              },
            },
            obj("kpiRevenue", "kpiRevenue", { x: 0, y: 6, w: 3, h: 4 }),
            obj("kpiSpend", "kpiSpend", { x: 3, y: 6, w: 3, h: 4 }),
            obj("kpiConversions", "kpiConversions", { x: 6, y: 6, w: 3, h: 4 }),
            obj("kpiRoas", "kpiRoas", { x: 9, y: 6, w: 3, h: 4 }),
            obj("chartRevenue", "chartRevenue", { x: 0, y: 10, w: 6, h: 10 }),
            obj("chartConversions", "chartConversions", { x: 6, y: 10, w: 6, h: 10 }),
            obj("chartRates", "chartRates", { x: 0, y: 20, w: 6, h: 10 }),
            obj("chartCommission", "chartCommission", { x: 6, y: 20, w: 6, h: 10 }),
          ],
        },
      ],
    },
    {
      name: "Campaigns",
      slug: "campaigns",
      showTabs: true,
      tabs: [
        {
          name: "List",
          widgets: [
            obj("tableCampaigns", "tableCampaigns", { x: 0, y: 0, w: 12, h: 14 }),
          ],
        },
        {
          name: "Breakdown",
          widgets: [
            obj("chartCampaignPie", "chartCampaignPie", { x: 0, y: 0, w: 6, h: 10 }),
            obj("chartSpendBars", "chartSpendBars", { x: 6, y: 0, w: 6, h: 10 }),
          ],
        },
      ],
    },
    {
      name: "Groups",
      slug: "groups",
      tabs: [
        {
          name: "Main",
          widgets: [
            obj("chartGroupSpend", "chartGroupSpend", { x: 0, y: 0, w: 12, h: 8 }),
            obj("tableGroups", "tableGroups", { x: 0, y: 8, w: 7, h: 12 }),
            obj("formGroup", "formGroup", { x: 7, y: 8, w: 5, h: 12 }, "tableGroups"),
          ],
        },
      ],
    },
  ],
  menu: [
    { label: "Overview", pageSlug: "overview" },
    { label: "Campaigns", pageSlug: "campaigns" },
    { label: "Groups", pageSlug: "groups" },
  ],
};
