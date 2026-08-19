import { SiteLiveScreen } from "@/components/sites/SiteLiveScreen";
import { resolveSiteRouteParams } from "@/server/sites/params";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

export default async function ViewSitePage({
  params,
  searchParams,
}: {
  params: Promise<{ siteSlug: string; pageSlug: string }>;
  searchParams: Promise<{ tab?: string; fs?: string }>;
}) {
  const { siteSlug, pageSlug } = await resolveSiteRouteParams(
    await params,
    "view",
  );
  const { tab, fs } = await searchParams;
  return (
    <SiteLiveScreen
      siteSlug={siteSlug}
      pageSlug={pageSlug}
      tabId={tab ?? null}
      autoFullscreen={fs === "1"}
    />
  );
}
