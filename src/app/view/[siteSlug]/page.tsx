import { SiteLiveScreen } from "@/components/sites/SiteLiveScreen";
import { resolveSiteRouteParams } from "@/server/sites/params";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

export default async function ViewSiteHomePage({
  params,
  searchParams,
}: {
  params: Promise<{ siteSlug: string }>;
  searchParams: Promise<{ tab?: string; fs?: string }>;
}) {
  const { siteSlug } = await resolveSiteRouteParams(await params, "view");
  const { tab, fs } = await searchParams;
  return (
    <SiteLiveScreen
      siteSlug={siteSlug}
      tabId={tab ?? null}
      autoFullscreen={fs === "1"}
    />
  );
}
