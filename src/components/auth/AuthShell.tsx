import type { ReactNode } from "react";
import { ArgentLogo } from "@/components/brand/ArgentLogo";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="landing flex min-h-screen items-center justify-center bg-[var(--landing-canvas,#f4f7f4)] px-4 py-10 font-[family-name:var(--font-landing-body)]">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center">
          <ArgentLogo href="/" size="lg" variant="pastel" />
          <h1 className="mt-5 font-[family-name:var(--font-landing-display)] text-xl font-medium tracking-tight text-[var(--landing-ink,#1e2a24)]">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-1 text-sm text-[var(--landing-ink-soft,#5a6b62)]">
              {subtitle}
            </p>
          ) : null}
        </div>
        {children}
        {footer ? (
          <div className="text-center text-sm text-[var(--landing-ink-soft,#5a6b62)]">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
