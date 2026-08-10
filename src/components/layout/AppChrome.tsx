"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { PanelLeftOpen } from "lucide-react";
import { SeeItMark } from "@/components/brand/SeeItLogo";
import { AppSidebar } from "@/components/layout/AppSidebar";
import type { AppSection } from "@/lib/auth/sections";
import type { ThemeId } from "@/lib/theme";
import { cn } from "@/lib/utils";

const SIDEBAR_STORAGE_KEY = "seeit-sidebar-open";
const MOBILE_MQ = "(max-width: 767px)";

export function AppChrome({
  children,
  user,
  allowedSections,
}: {
  children: React.ReactNode;
  user: {
    name: string;
    email: string;
    roleLabel: string;
    theme: ThemeId;
  } | null;
  allowedSections: AppSection[];
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ);
    function syncMobile(matches: boolean) {
      setIsMobile(matches);
      if (matches) {
        // Phones: drawer closed by default so content gets the full width.
        setSidebarOpen(false);
      } else {
        const stored = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
        setSidebarOpen(stored !== "0");
      }
    }
    syncMobile(mq.matches);
    const onChange = (event: MediaQueryListEvent) => syncMobile(event.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Close the mobile drawer after navigating.
  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [pathname, isMobile]);

  function toggleSidebar() {
    setSidebarOpen((open) => {
      const next = !open;
      if (!isMobile) {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "1" : "0");
      }
      return next;
    });
  }

  if (
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname === "/verify-email" ||
    pathname === "/onboarding" ||
    (!user && pathname === "/")
  ) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop: width-collapsing rail. Mobile: fixed overlay drawer. */}
      <div
        className={cn(
          "shrink-0 overflow-hidden transition-[width] duration-200 ease-out",
          isMobile ? "w-0" : sidebarOpen ? "w-60" : "w-0",
        )}
      >
        {!isMobile ? (
          <div className="h-full w-60">
            <AppSidebar
              user={user}
              allowedSections={allowedSections}
              onClose={toggleSidebar}
            />
          </div>
        ) : null}
      </div>

      {isMobile && sidebarOpen ? (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-[1px]"
            onClick={toggleSidebar}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-60 shadow-xl">
            <AppSidebar
              user={user}
              allowedSections={allowedSections}
              onClose={toggleSidebar}
            />
          </div>
        </>
      ) : null}

      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        {!sidebarOpen ? (
          <button
            type="button"
            onClick={toggleSidebar}
            title="Open sidebar"
            aria-label="Open sidebar"
            className="absolute left-3 top-3 z-30 flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-1.5 text-ink-soft shadow-sm transition-colors hover:bg-canvas hover:text-ink"
          >
            <SeeItMark size={22} variant="pastel" />
            <PanelLeftOpen className="size-3.5" />
          </button>
        ) : null}
        <main
          className={cn(
            "flex min-h-0 flex-1 flex-col overflow-y-auto",
            !sidebarOpen && "pt-12",
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
