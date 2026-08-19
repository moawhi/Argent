"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Expand, Loader2, Upload } from "lucide-react";
import { setSitePublishedAction } from "@/app/sites/actions";
import { Button } from "@/components/ui/button";
import { siteLivePath } from "@/lib/sites/paths";

export function SitePublishControls({
  dashboardId,
  siteSlug,
  pageSlug,
  published,
}: {
  dashboardId: string;
  siteSlug: string;
  pageSlug?: string;
  published: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const liveHref = `${siteLivePath(siteSlug, pageSlug)}?fs=1`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={liveHref}>
        <Button variant="secondary">
          <Expand />
          {published ? "View live" : "Preview fullscreen"}
        </Button>
      </Link>
      <Button
        variant={published ? "ghost" : "primary"}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await setSitePublishedAction(dashboardId, !published);
            router.refresh();
          })
        }
      >
        {pending ? (
          <Loader2 className="animate-spin" />
        ) : published ? (
          <Check />
        ) : (
          <Upload />
        )}
        {published ? "Unpublish" : "Publish"}
      </Button>
    </div>
  );
}
