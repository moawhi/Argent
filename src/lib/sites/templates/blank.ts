import type { SiteTemplate } from "@/lib/sites/types";

export const blankTemplate: SiteTemplate = {
  key: "blank",
  name: "Blank",
  description: "One empty Home page and a header menu. Add pages, tabs and tiles from there.",
  category: "Starter",
  withDefaultFilters: true,
  pages: [
    {
      name: "Home",
      slug: "home",
      isHome: true,
      tabs: [{ name: "Main", widgets: [] }],
    },
  ],
  menu: [{ label: "Home", pageSlug: "home" }],
};
