"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BookOpen,
  Boxes,
  LayoutDashboard,
  LogOut,
  Palette,
  PanelLeftClose,
  Plug,
  Send,
  Telescope,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SECTION_META, type AppSection } from "@/lib/auth/sections";
import { SeeItLogo } from "@/components/brand/SeeItLogo";
import { ThemePicker } from "@/components/theme/ThemePicker";
import { logoutAction } from "@/app/login/actions";
import type { ThemeId } from "@/lib/theme";

const ICONS = {
  dashboards: LayoutDashboard,
  objects: Boxes,
  explorer: Telescope,
  requests: Send,
  connections: Plug,
  docs: BookOpen,
  users: Users,
} as const;

const NAV_ORDER: AppSection[] = [
  "dashboards",
  "objects",
  "explorer",
  "requests",
  "connections",
  "docs",
  "users",
];

export function AppSidebar({
  user,
  allowedSections,
  onClose,
}: {
  user: {
    name: string;
    email: string;
    roleLabel: string;
    theme: ThemeId;
  } | null;
  allowedSections: AppSection[];
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const allowed = new Set(allowedSections);

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-line bg-surface">
      <div className="flex h-14 items-center gap-2 border-b border-line px-3">
        <Link href="/" className="flex min-w-0 flex-1 items-center px-1">
          <SeeItLogo size="sm" variant="pastel" className="min-w-0" />
        </Link>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            title="Close sidebar"
            aria-label="Close sidebar"
            className="flex size-7 items-center justify-center rounded-md text-ink-faint transition-colors hover:bg-canvas hover:text-ink"
          >
            <PanelLeftClose className="size-4" />
          </button>
        ) : null}
      </div>

      <nav className="flex-1 space-y-0.5 p-2">
        {NAV_ORDER.filter((section) => allowed.has(section)).map((section) => {
          const meta = SECTION_META[section];
          const active =
            pathname === meta.href || pathname.startsWith(`${meta.href}/`);
          const Icon = ICONS[section];
          return (
            <Link
              key={section}
              href={meta.href}
              title={meta.hint}
              className={cn(
                "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                active
                  ? "bg-brand-soft font-medium text-brand-ink"
                  : "text-ink-soft hover:bg-canvas hover:text-ink",
              )}
            >
              <Icon className="size-4 shrink-0" />
              {meta.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-line p-3">
        {user ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-canvas"
            >
              <span className="flex size-7 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand-ink">
                {user.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {user.name}
                </span>
                <span className="block truncate text-[11px] text-ink-faint">
                  {user.roleLabel}
                </span>
              </span>
              <Palette className="size-3.5 text-ink-faint" />
            </button>

            {menuOpen ? (
              <div className="absolute bottom-full left-0 right-0 z-20 mb-2 rounded-xl border border-line bg-surface p-2 shadow-lg">
                <p className="truncate px-2 pb-2 text-[11px] text-ink-faint">
                  {user.email}
                </p>
                <ThemePicker compact />
                <Link
                  href="/settings"
                  className="mt-1 block rounded-lg px-2 py-1.5 text-sm text-ink-soft hover:bg-canvas hover:text-ink"
                  onClick={() => setMenuOpen(false)}
                >
                  Appearance settings
                </Link>
                <form action={logoutAction} className="mt-1">
                  <button
                    type="submit"
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-ink-soft hover:bg-canvas hover:text-ink"
                  >
                    <LogOut className="size-3.5" />
                    Log out
                  </button>
                </form>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-[11px] leading-relaxed text-ink-faint">
            Sign in to personalize appearance and access.
          </p>
        )}
      </div>
    </aside>
  );
}
