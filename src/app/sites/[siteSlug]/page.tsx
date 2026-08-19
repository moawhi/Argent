import { SiteScreen } from "@/components/sites/SiteScreen";
import { resolveSiteRouteParams } from "@/server/sites/params";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

export default async function SiteHomePage({
  params,
}: {
  params: Promise<{ siteSlug: string }>;
}) {
  const { siteSlug } = await resolveSiteRouteParams(await params, "sites");
  return <SiteScreen siteSlug={siteSlug} />;
}
