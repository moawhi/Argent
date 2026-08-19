import type { SiteTemplate } from "@/lib/sites/types";
import { blankTemplate } from "./blank";
import { campaignHubTemplate } from "./campaign-hub";
import { analyticsTemplate } from "./analytics";
import { workspaceTemplate } from "./workspace";

export const SITE_TEMPLATES: SiteTemplate[] = [
  blankTemplate,
  campaignHubTemplate,
  analyticsTemplate,
  workspaceTemplate,
];

export function getSiteTemplate(key: string): SiteTemplate | undefined {
  return SITE_TEMPLATES.find((template) => template.key === key);
}

export function listSiteTemplates(): SiteTemplate[] {
  return SITE_TEMPLATES;
}
