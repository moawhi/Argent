import Link from "next/link";
import { ChevronRight } from "lucide-react";

export interface Crumb {
  label: string;
  href?: string;
}

export function PageHeader({
  title,
  description,
  crumbs,
  actions,
  /** Tighter chrome for immersive pages (docs, dashboards). */
  dense = false,
}: {
  title: string;
  description?: string;
  crumbs?: Crumb[];
  actions?: React.ReactNode;
  dense?: boolean;
}) {
  return (
    <header className="shrink-0 border-b border-line bg-surface">
      <div
        className={
          dense
            ? "mx-auto max-w-7xl px-3 py-3 sm:px-6 sm:py-4"
            : "mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-5"
        }
      >
        {crumbs?.length ? (
          <nav className="mb-1 flex flex-wrap items-center gap-1 text-xs text-ink-faint sm:mb-1.5">
            {crumbs.map((crumb, index) => (
              <span
                key={`${crumb.label}-${index}`}
                className="flex min-w-0 items-center gap-1"
              >
                {index > 0 ? (
                  <ChevronRight className="size-3 shrink-0" />
                ) : null}
                {crumb.href ? (
                  <Link href={crumb.href} className="hover:text-ink">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="truncate">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        ) : null}

        <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0 space-y-0.5 sm:space-y-1">
            <h1
              className={
                dense
                  ? "truncate text-base font-semibold tracking-tight text-ink sm:text-lg"
                  : "text-lg font-semibold tracking-tight text-ink sm:text-xl"
              }
            >
              {title}
            </h1>
            {description ? (
              <p
                className={
                  dense
                    ? "hidden max-w-2xl text-sm text-ink-soft sm:line-clamp-2 sm:block"
                    : "max-w-2xl text-sm text-ink-soft"
                }
              >
                {description}
              </p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex flex-wrap items-center gap-2">{actions}</div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

export function PageBody({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6 ${className}`}>
      {children}
    </div>
  );
}
