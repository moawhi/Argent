"use client";

import Link from "next/link";
import { useId } from "react";
import { APP_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

type LogoSize = "sm" | "md" | "lg" | "xl";
type LogoVariant = "pastel" | "solid" | "ink";

const SIZE = {
  sm: { mark: 22, text: "text-sm", gap: "gap-1.5" },
  md: { mark: 28, text: "text-lg", gap: "gap-2" },
  lg: { mark: 36, text: "text-2xl", gap: "gap-2.5" },
  xl: { mark: 52, text: "text-5xl sm:text-7xl", gap: "gap-3.5" },
} as const;

/**
 * Three glossy number cards — mint / sand / sky — overlapping and bridged so
 * they read as one interconnected mark (Aave-card gloss + KPI metaphor).
 */
export function ArgentMark({
  size = 28,
  variant = "pastel",
  className,
  title = APP_NAME,
}: {
  size?: number;
  variant?: LogoVariant;
  className?: string;
  title?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const mint = `m-${uid}`;
  const sand = `s-${uid}`;
  const sky = `k-${uid}`;
  const gloss = `g-${uid}`;

  const a =
    variant === "pastel"
      ? `url(#${mint})`
      : variant === "solid"
        ? "var(--color-brand)"
        : "currentColor";
  const b =
    variant === "pastel"
      ? `url(#${sand})`
      : variant === "solid"
        ? "color-mix(in oklab, var(--color-brand) 70%, #e2d4b8)"
        : "currentColor";
  const c =
    variant === "pastel"
      ? `url(#${sky})`
      : variant === "solid"
        ? "color-mix(in oklab, var(--color-brand) 55%, #b7cfe0)"
        : "currentColor";

  const digit =
    variant === "pastel" ? "rgba(30,42,36,0.58)" : "rgba(255,255,255,0.9)";
  const link =
    variant === "pastel" ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.35)";
  const inkOpacity = variant === "ink" ? { a: 0.55, b: 0.78, c: 1 } : null;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(
        "shrink-0",
        variant === "ink" && "text-[var(--landing-ink,var(--color-ink))]",
        className,
      )}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <defs>
        {variant === "pastel" ? (
          <>
            <linearGradient
              id={mint}
              x1="4"
              y1="3"
              x2="18"
              y2="18"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#E8F6F0" />
              <stop offset="0.45" stopColor="#B9DCCF" />
              <stop offset="1" stopColor="#8FC4B0" />
            </linearGradient>
            <linearGradient
              id={sand}
              x1="3"
              y1="14"
              x2="17"
              y2="30"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#F7F1E4" />
              <stop offset="0.5" stopColor="#E2D4B8" />
              <stop offset="1" stopColor="#C9B896" />
            </linearGradient>
            <linearGradient
              id={sky}
              x1="14"
              y1="8"
              x2="30"
              y2="26"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#E8F2F8" />
              <stop offset="0.5" stopColor="#B7CFE0" />
              <stop offset="1" stopColor="#8EB4CB" />
            </linearGradient>
          </>
        ) : null}
        <linearGradient id={gloss} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#FFFFFF" stopOpacity="0.72" />
          <stop offset="0.4" stopColor="#FFFFFF" stopOpacity="0.1" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
      </defs>

      <path
        d="M12.5 14.2c2.4-1.1 5.4-1.2 8.4.4"
        stroke={link}
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M12 18.8c1.9 2.2 4.8 3.4 8.4 3"
        stroke={link}
        strokeWidth="2.6"
        strokeLinecap="round"
      />

      <g opacity={inkOpacity?.a}>
        <rect x="3.5" y="3.5" width="13.5" height="13.5" rx="3.2" fill={a} />
        <rect
          x="3.5"
          y="3.5"
          width="13.5"
          height="13.5"
          rx="3.2"
          fill={`url(#${gloss})`}
        />
        <rect x="6.2" y="7.1" width="5" height="1.55" rx="0.75" fill={digit} />
        <rect x="6.2" y="10.1" width="7.8" height="3.1" rx="1" fill={digit} />
      </g>

      <g opacity={inkOpacity?.b}>
        <rect x="3.5" y="15" width="13.5" height="13.5" rx="3.2" fill={b} />
        <rect
          x="3.5"
          y="15"
          width="13.5"
          height="13.5"
          rx="3.2"
          fill={`url(#${gloss})`}
        />
        <rect x="6.2" y="18.6" width="4.3" height="1.55" rx="0.75" fill={digit} />
        <rect x="6.2" y="21.6" width="7" height="3.1" rx="1" fill={digit} />
      </g>

      <g opacity={inkOpacity?.c}>
        <rect x="15" y="9" width="13.5" height="13.5" rx="3.2" fill={c} />
        <rect
          x="15"
          y="9"
          width="13.5"
          height="13.5"
          rx="3.2"
          fill={`url(#${gloss})`}
        />
        <rect x="17.7" y="12.6" width="4.6" height="1.55" rx="0.75" fill={digit} />
        <rect x="17.7" y="15.6" width="7.8" height="3.1" rx="1" fill={digit} />
        <circle cx="25.3" cy="11.7" r="2.15" fill="white" fillOpacity="0.55" />
      </g>
    </svg>
  );
}

export function ArgentWordmark({
  size = "md",
  className,
}: {
  size?: LogoSize;
  className?: string;
}) {
  const s = SIZE[size];
  return (
    <span
      className={cn(
        "font-[family-name:var(--font-landing-display)] font-semibold tracking-tight text-[var(--landing-ink,var(--color-ink))]",
        s.text,
        className,
      )}
    >
      Arg
      <span className="text-[var(--landing-accent,var(--color-brand))]">ent</span>
    </span>
  );
}

function LogoInner({
  size,
  variant,
  markOnly,
  wordmarkOnly,
  className,
}: {
  size: LogoSize;
  variant: LogoVariant;
  markOnly: boolean;
  wordmarkOnly: boolean;
  className?: string;
}) {
  const s = SIZE[size];
  return (
    <span className={cn("inline-flex items-center", s.gap, className)}>
      {wordmarkOnly ? null : <ArgentMark size={s.mark} variant={variant} />}
      {markOnly ? null : <ArgentWordmark size={size} />}
    </span>
  );
}

export function ArgentLogo({
  size = "md",
  variant = "pastel",
  markOnly = false,
  wordmarkOnly = false,
  href,
  className,
}: {
  size?: LogoSize;
  variant?: LogoVariant;
  markOnly?: boolean;
  wordmarkOnly?: boolean;
  href?: string;
  className?: string;
}) {
  const inner = (
    <LogoInner
      size={size}
      variant={variant}
      markOnly={markOnly}
      wordmarkOnly={wordmarkOnly}
      className={className}
    />
  );

  if (!href) return inner;

  return (
    <Link href={href} className="inline-flex items-center no-underline">
      {inner}
    </Link>
  );
}
