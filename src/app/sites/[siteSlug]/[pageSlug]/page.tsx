import { SiteScreen } from "@/components/sites/SiteScreen";
import { resolveSiteRouteParams } from "@/server/sites/params";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

export default async function SitePage({
  params,
  searchParams,
}: {
  params: Promise<{ siteSlug: string; pageSlug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { siteSlug, pageSlug } = await resolveSiteRouteParams(
    await params,
    "sites",
  );
  const { tab } = await searchParams;
  return (
    <SiteScreen siteSlug={siteSlug} pageSlug={pageSlug} tabId={tab ?? null} />
  );
}
