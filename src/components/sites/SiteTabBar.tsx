"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import {
  createTabAction,
  deleteTabAction,
  updateTabAction,
} from "@/app/sites/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export function SiteTabBar({
  dashboardId,
  pageId,
  siteSlug,
  pageSlug,
  tabs,
  currentTabId,
  showTabs,
  editing,
  hrefBase,
  preview = false,
}: {
  dashboardId: string;
  pageId: string;
  siteSlug: string;
  pageSlug: string;
  tabs: { id: string; name: string }[];
  currentTabId: string;
  showTabs: boolean;
  editing?: boolean;
  hrefBase?: string;
  preview?: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  if (!showTabs && tabs.length <= 1 && !editing) return null;

  function go(tabId: string) {
    const params = new URLSearchParams();
    if (tabs[0]?.id !== tabId) params.set("tab", tabId);
    const query = params.toString();
    router.push(
      `${hrefBase ?? `/sites/${siteSlug}`}/${pageSlug}${query ? `?${query}` : ""}`,
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-line bg-surface px-3 py-1.5 sm:px-6">
      {tabs.map((tab) => {
        const active = tab.id === currentTabId;
        if (renaming === tab.id) {
          return (
            <form
              key={tab.id}
              className="flex items-center gap-1"
              onSubmit={(event) => {
                event.preventDefault();
                startTransition(async () => {
                  await updateTabAction(dashboardId, tab.id, draft);
                  setRenaming(null);
                  router.refresh();
                });
              }}
            >
              <Input
                autoFocus
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                className="h-7 w-28 text-xs"
              />
            </form>
          );
        }
        return (
          <div key={tab.id} className="flex items-center">
            <button
              type="button"
              onClick={() => go(tab.id)}
              onDoubleClick={() => {
                if (preview) return;
                setRenaming(tab.id);
                setDraft(tab.name);
              }}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs",
                active
                  ? "bg-brand-soft font-medium text-brand-ink"
                  : "text-ink-soft hover:bg-canvas hover:text-ink",
              )}
            >
              {tab.name}
            </button>
            {editing && tabs.length > 1 ? (
              <button
                type="button"
                title="Remove tab"
                className="rounded p-0.5 text-ink-faint hover:text-danger"
                onClick={() =>
                  startTransition(async () => {
                    await deleteTabAction(dashboardId, tab.id);
                    router.refresh();
                  })
                }
              >
                <X className="size-3" />
              </button>
            ) : null}
          </div>
        );
      })}
      {editing ? (
        <Button
          size="sm"
          variant="ghost"
          className="h-7"
          onClick={() =>
            startTransition(async () => {
              const result = await createTabAction(dashboardId, pageId);
              if (result.id) go(result.id);
              router.refresh();
            })
          }
        >
          <Plus className="size-3.5" />
          Tab
        </Button>
      ) : null}
    </div>
  );
}
