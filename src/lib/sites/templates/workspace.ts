import type { SiteTemplate } from "@/lib/sites/types";

export const workspaceTemplate: SiteTemplate = {
  key: "workspace",
  name: "Workspace",
  description:
    "A welcome page with copy, plus a Data page for tables and forms when a connection exists.",
  category: "Sample",
  withDefaultFilters: false,
  pages: [
    {
      name: "Welcome",
      slug: "welcome",
      isHome: true,
      tabs: [
        {
          name: "Main",
          widgets: [
            {
              key: "welcomeHeading",
              blockKind: "heading",
              layout: { x: 0, y: 0, w: 12, h: 3 },
              blockConfig: { text: "Welcome", level: 1 },
            },
            {
              key: "welcomeBody",
              blockKind: "richtext",
              layout: { x: 0, y: 3, w: 8, h: 8 },
              blockConfig: {
                markdown:
                  "This site is a starting point.\n\n- Edit this text in **Design** mode\n- Add pages and a menu from site settings\n- Open **Data** for live tables and forms from your API\n\nFilters stay off until you turn them on.",
              },
            },
            {
              key: "welcomeAside",
              blockKind: "richtext",
              layout: { x: 8, y: 3, w: 4, h: 8 },
              blockConfig: {
                markdown:
                  "**Next**\n\n1. Rename this site\n2. Point the Data page at your objects\n3. Link a table row to a form",
              },
            },
          ],
        },
      ],
    },
    {
      name: "Data",
      slug: "data",
      tabs: [
        {
          name: "Main",
          widgets: [
            {
              key: "dataHeading",
              blockKind: "heading",
              layout: { x: 0, y: 0, w: 12, h: 3 },
              blockConfig: { text: "Live data", level: 2 },
            },
            {
              key: "dataTable",
              blockKind: "object",
              objectKey: "table",
              layout: { x: 0, y: 3, w: 7, h: 12 },
            },
            {
              key: "dataForm",
              blockKind: "object",
              objectKey: "form",
              layout: { x: 7, y: 3, w: 5, h: 12 },
            },
          ],
        },
      ],
    },
  ],
  menu: [
    { label: "Welcome", pageSlug: "welcome" },
    { label: "Data", pageSlug: "data" },
  ],
};
