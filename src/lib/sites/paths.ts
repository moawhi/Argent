/** Header set by middleware so route pages can recover the slug if params are empty. */
export const SITE_PATHNAME_HEADER = "x-argent-pathname";

export function siteEditorPath(
  siteSlug: string,
  pageSlug?: string | null,
  tabId?: string | null,
) {
  return sitePath("/sites", siteSlug, pageSlug, tabId);
}

export function siteLivePath(
  siteSlug: string,
  pageSlug?: string | null,
  tabId?: string | null,
) {
  return sitePath("/view", siteSlug, pageSlug, tabId);
}

function sitePath(
  root: "/sites" | "/view",
  siteSlug: string,
  pageSlug?: string | null,
  tabId?: string | null,
) {
  const base = pageSlug ? `${root}/${siteSlug}/${pageSlug}` : `${root}/${siteSlug}`;
  if (!tabId) return base;
  const params = new URLSearchParams({ tab: tabId });
  return `${base}?${params.toString()}`;
}
