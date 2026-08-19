"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Loader2, Maximize2, Minimize2, Pencil, Upload } from "lucide-react";
import { setSitePublishedAction } from "@/app/sites/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { SiteWorkspace } from "@/components/sites/SiteWorkspace";
import { siteEditorPath } from "@/lib/sites/paths";
import type { SiteView } from "@/server/sites/service";

export function SiteLiveView({
  site,
  autoFullscreen = false,
  canPublish = false,
  canEdit = false,
}: {
  site: SiteView;
  autoFullscreen?: boolean;
  canPublish?: boolean;
  canEdit?: boolean;
}) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    function onChange() {
      setFullscreen(document.fullscreenElement === rootRef.current);
    }
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    if (!autoFullscreen) return;
    const node = rootRef.current;
    if (!node || document.fullscreenElement) return;
    void node.requestFullscreen?.().catch(() => {
      // Browser may block auto-fullscreen without a fresh user gesture.
    });
  }, [autoFullscreen]);

  function toggleFullscreen() {
    const node = rootRef.current;
    if (!node) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    void node.requestFullscreen?.();
  }

  return (
    <div
      ref={rootRef}
      className="flex h-screen flex-col bg-canvas text-ink"
    >
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line bg-surface px-3 py-2 sm:px-4">
        <Link href="/sites" className="shrink-0">
          <Button size="icon" variant="ghost" title="Back to sites">
            <ArrowLeft />
          </Button>
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-sm font-semibold">{site.name}</h1>
            {site.published ? (
              <Badge tone="positive">Published</Badge>
            ) : (
              <Badge tone="warning">Preview</Badge>
            )}
          </div>
          {site.currentPage.isHome ? null : (
            <p className="truncate text-[11px] text-ink-faint">
              {site.currentPage.name}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canPublish ? (
            <Button
              size="sm"
              variant={site.published ? "secondary" : "primary"}
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await setSitePublishedAction(site.id, !site.published);
                  router.refresh();
                })
              }
            >
              {pending ? (
                <Loader2 className="animate-spin" />
              ) : site.published ? (
                <Check />
              ) : (
                <Upload />
              )}
              {site.published ? "Unpublish" : "Publish"}
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="secondary"
            onClick={toggleFullscreen}
            title={fullscreen ? "Exit full screen" : "Full screen"}
          >
            {fullscreen ? <Minimize2 /> : <Maximize2 />}
            <span className="hidden sm:inline">
              {fullscreen ? "Exit full screen" : "Full screen"}
            </span>
          </Button>
          {canEdit ? (
          <Link
            href={siteEditorPath(
              site.slug,
              site.currentPage.isHome ? undefined : site.currentPage.slug,
            )}
          >
            <Button size="sm" variant="ghost">
              <Pencil />
              <span className="hidden sm:inline">Edit</span>
            </Button>
          </Link>
          ) : null}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        <SiteWorkspace
          site={site}
          availableObjects={[]}
          preview
          hrefBase={`/view/${site.slug}`}
        />
      </div>
    </div>
  );
}
