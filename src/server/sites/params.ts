import "server-only";

import { headers } from "next/headers";
import { SITE_PATHNAME_HEADER } from "@/lib/sites/paths";

function firstString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    try {
      return decodeURIComponent(trimmed);
    } catch {
      return trimmed;
    }
  }
  if (Array.isArray(value)) return firstString(value[0]);
  return undefined;
}

function pathParts(pathname: string, root: "sites" | "view") {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== root || !parts[1]) return {};
  return { siteSlug: parts[1], pageSlug: parts[2] };
}

export async function resolveSiteRouteParams(
  params: { siteSlug?: unknown; pageSlug?: unknown },
  root: "sites" | "view",
): Promise<{ siteSlug: string; pageSlug?: string }> {
  let siteSlug = firstString(params.siteSlug);
  let pageSlug = firstString(params.pageSlug);

  if (!siteSlug) {
    const pathname = (await headers()).get(SITE_PATHNAME_HEADER) ?? "";
    const fromPath = pathParts(pathname, root);
    siteSlug = fromPath.siteSlug;
    pageSlug = pageSlug ?? fromPath.pageSlug;
  }

  return { siteSlug: siteSlug ?? "", pageSlug };
}
