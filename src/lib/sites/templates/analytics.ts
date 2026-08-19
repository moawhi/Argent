import type { SiteTemplate } from "@/lib/sites/types";

export const analyticsTemplate: SiteTemplate = {
  key: "analytics",
  name: "Analytics",
  description:
    "Intro copy and a KPI row on Home, with Trends and Breakdown tabs for charts.",
  category: "Sample",
  withDefaultFilters: true,
  pages: [
    {
      name: "Home",
      slug: "home",
      isHome: true,
      showTabs: true,
      tabs: [
        {
          name: "Overview",
          widgets: [
            {
              key: "analyticsHeading",
              blockKind: "heading",
              layout: { x: 0, y: 0, w: 12, h: 3 },
              blockConfig: { text: "Analytics", level: 1 },
            },
            {
              key: "analyticsIntro",
              blockKind: "richtext",
              layout: { x: 0, y: 3, w: 12, h: 4 },
              blockConfig: {
                markdown:
                  "Use the **Trends** and **Breakdown** tabs for charts. Number cards below use objects from the connection you picked, if any.",
              },
            },
            {
              key: "kpi1",
              blockKind: "object",
              objectKey: "kpi",
              layout: { x: 0, y: 7, w: 3, h: 4 },
            },
            {
              key: "kpi2",
              blockKind: "object",
              objectKey: "kpi",
              layout: { x: 3, y: 7, w: 3, h: 4 },
            },
          ],
        },
        {
          name: "Trends",
          widgets: [
            {
              key: "trendChart",
              blockKind: "object",
              objectKey: "chart",
              layout: { x: 0, y: 0, w: 12, h: 12 },
            },
          ],
        },
        {
          name: "Breakdown",
          widgets: [
            {
              key: "breakdownChart",
              blockKind: "object",
              objectKey: "chart",
              layout: { x: 0, y: 0, w: 12, h: 12 },
            },
          ],
        },
      ],
    },
  ],
  menu: [{ label: "Home", pageSlug: "home" }],
};
