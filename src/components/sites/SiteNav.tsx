"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MenuItemView } from "@/server/dashboards/service";

export function SiteNav({
  siteSlug,
  items,
  currentPageSlug,
  hrefBase,
}: {
  siteSlug: string;
  items: MenuItemView[];
  currentPageSlug: string;
  hrefBase?: string;
}) {
  if (items.length === 0) return null;
  const root = hrefBase ?? `/sites/${siteSlug}`;

  return (
    <nav className="flex flex-wrap items-center gap-1 border-b border-line bg-surface px-3 py-2 sm:px-6">
      {items.map((item) => {
        const href = item.pageSlug
          ? `${root}/${item.pageSlug}`
          : undefined;
        const active = item.pageSlug === currentPageSlug;
        const childActive = item.children.some(
          (child) => child.pageSlug === currentPageSlug,
        );

        if (item.children.length > 0) {
          return (
            <div key={item.id} className="group relative">
              <button
                type="button"
                className={cn(
                  "inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm",
                  active || childActive
                    ? "bg-brand-soft font-medium text-brand-ink"
                    : "text-ink-soft hover:bg-canvas hover:text-ink",
                )}
              >
                {item.label}
                <ChevronDown className="size-3.5" />
              </button>
              <div className="invisible absolute left-0 top-full z-20 min-w-[10rem] pt-1 opacity-0 transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                <div className="rounded-lg border border-line bg-surface py-1 shadow-lg">
                  {href ? (
                    <Link
                      href={href}
                      className={cn(
                        "block px-3 py-1.5 text-sm hover:bg-canvas",
                        active ? "font-medium text-brand-ink" : "text-ink",
                      )}
                    >
                      {item.label}
                    </Link>
                  ) : null}
                  {item.children.map((child) => {
                    const childHref = child.pageSlug
                      ? `${root}/${child.pageSlug}`
                      : "#";
                    return (
                      <Link
                        key={child.id}
                        href={childHref}
                        className={cn(
                          "block px-3 py-1.5 text-sm hover:bg-canvas",
                          child.pageSlug === currentPageSlug
                            ? "font-medium text-brand-ink"
                            : "text-ink",
                        )}
                      >
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        }

        if (!href) {
          return (
            <span
              key={item.id}
              className="rounded-lg px-2.5 py-1.5 text-sm text-ink-faint"
            >
              {item.label}
            </span>
          );
        }

        return (
          <Link
            key={item.id}
            href={href}
            className={cn(
              "rounded-lg px-2.5 py-1.5 text-sm",
              active
                ? "bg-brand-soft font-medium text-brand-ink"
                : "text-ink-soft hover:bg-canvas hover:text-ink",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
