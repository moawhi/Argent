"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SeeItLogo } from "@/components/brand/SeeItLogo";
import { cn } from "@/lib/utils";

const VALUE_CARDS = [
  {
    title: "Connect",
    body: "Import OpenAPI or plug in Postgres, MariaDB or ClickHouse. Credentials stay encrypted on the server.",
    tone: "mint" as const,
    delay: "0s",
  },
  {
    title: "Shape",
    body: "Turn endpoints into MCP tools for agents — and into tables, charts and forms for your team.",
    tone: "sand" as const,
    delay: "0.12s",
  },
  {
    title: "Arrange",
    body: "Drop tiles on a dashboard grid, wire filters once, and keep large result sets paging smoothly.",
    tone: "sky" as const,
    delay: "0.24s",
  },
];

const MCP_STEPS = [
  {
    title: "Import",
    body: "Bring in the OpenAPI for any backend you already run.",
  },
  {
    title: "Select",
    body: "Pick which operations become tools agents may call.",
  },
  {
    title: "Connect",
    body: "Point Cursor or Claude at the hosted MCP URL with a token.",
  },
];

const TONE_CLASS = {
  mint: "from-[#d8f0e6] via-[#c5e8dc] to-[#a8d5c8]",
  sand: "from-[#f3ead8] via-[#ebe0cc] to-[#ddd0b8]",
  sky: "from-[#d6e8f2] via-[#c5dcec] to-[#aecbde]",
};

export function LandingPage() {
  const [ready, setReady] = useState(false);
  const [activeCard, setActiveCard] = useState(0);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveCard((index) => (index + 1) % VALUE_CARDS.length);
    }, 4200);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="landing min-h-screen overflow-x-hidden bg-[var(--landing-canvas)] text-[var(--landing-ink)]">
      <header className="relative z-20 flex items-center justify-between px-6 py-5 sm:px-10">
        <SeeItLogo href="/" size="md" variant="pastel" />
        <Link
          href="/login"
          className="text-sm font-medium text-[var(--landing-ink-soft)] transition-colors hover:text-[var(--landing-ink)]"
        >
          Sign in
        </Link>
      </header>

      {/* Hero — one composition: brand, headline, line, CTAs, full-bleed atmosphere */}
      <section className="relative isolate min-h-[min(92vh,56rem)] overflow-hidden px-6 pb-16 pt-8 sm:px-10 sm:pt-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
        >
          <div className="landing-aurora absolute inset-0" />
          <div className="landing-blob landing-blob-a" />
          <div className="landing-blob landing-blob-b" />
          <div className="landing-blob landing-blob-c" />
          <div className="landing-grid absolute inset-0 opacity-[0.35]" />
          <div className="landing-dashboard-plane absolute inset-x-0 bottom-0 h-[42%] sm:h-[48%]" />
        </div>

        <div
          className={cn(
            "mx-auto max-w-3xl transition-all duration-700 ease-out",
            ready ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
          )}
        >
          <SeeItLogo size="xl" variant="pastel" className="items-end" />
          <h1 className="mt-5 max-w-2xl font-[family-name:var(--font-landing-display)] text-3xl font-medium leading-[1.15] tracking-tight text-[var(--landing-ink)] sm:text-5xl">
            MCP from your existing API — in minutes.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-[var(--landing-ink-soft)] sm:text-lg">
            Import an OpenAPI spec, pick the endpoints agents may call, and get
            a hosted MCP URL for Cursor and Claude — credentials never leave
            seeIt&apos;s gateway. Dashboards come along for free.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--landing-ink)] px-5 py-3 text-sm font-semibold text-[var(--landing-canvas)] transition-transform duration-200 hover:-translate-y-0.5"
            >
              Get started
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-medium text-[var(--landing-ink-soft)] transition-colors hover:text-[var(--landing-ink)]"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* Soft value cards — Aave-inspired interaction, seeIt palette */}
      <section className="relative px-6 py-20 sm:px-10 sm:py-28">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-[family-name:var(--font-landing-display)] text-3xl font-medium tracking-tight sm:text-4xl">
            Soft tiles. Real work.
          </h2>
          <p className="mt-3 max-w-xl text-base text-[var(--landing-ink-soft)]">
            Three steps from a dry OpenAPI file to tools your agents can call —
            and dashboards your team can rearrange without shipping another
            frontend.
          </p>

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {VALUE_CARDS.map((card, index) => {
              const active = index === activeCard;
              return (
                <button
                  key={card.title}
                  type="button"
                  onMouseEnter={() => setActiveCard(index)}
                  onFocus={() => setActiveCard(index)}
                  className={cn(
                    "landing-value-card group relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br p-6 text-left transition-all duration-500 ease-out",
                    TONE_CLASS[card.tone],
                    active
                      ? "z-10 scale-[1.02] shadow-[0_24px_60px_-28px_rgba(40,55,50,0.35)]"
                      : "scale-100 opacity-90",
                  )}
                  style={{ animationDelay: card.delay }}
                >
                  <div
                    aria-hidden
                    className="landing-mascot absolute -right-6 -top-6 size-28 rounded-full bg-white/35 blur-[1px]"
                  />
                  <div
                    aria-hidden
                    className="landing-mascot-core absolute right-6 top-8 size-16 rounded-[40%] bg-white/55"
                  />
                  <p className="relative font-[family-name:var(--font-landing-display)] text-2xl font-semibold tracking-tight">
                    {card.title}
                  </p>
                  <p className="relative mt-3 text-sm leading-relaxed text-[var(--landing-ink-soft)]">
                    {card.body}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="mt-6 flex justify-center gap-2 md:hidden">
            {VALUE_CARDS.map((card, index) => (
              <button
                key={card.title}
                type="button"
                aria-label={`Show ${card.title}`}
                onClick={() => setActiveCard(index)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  index === activeCard
                    ? "w-6 bg-[var(--landing-ink)]"
                    : "w-1.5 bg-[var(--landing-ink)]/25",
                )}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[var(--landing-ink)]/8 px-6 py-20 sm:px-10 sm:py-28">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-[family-name:var(--font-landing-display)] text-3xl font-medium tracking-tight sm:text-4xl">
            Hosted MCP from any backend API.
          </h2>
          <p className="mt-3 max-w-xl text-base text-[var(--landing-ink-soft)]">
            Skip writing a custom MCP server. seeIt turns the APIs you already
            have into tools agents can use — safely, through your vaulted
            gateway.
          </p>

          <ol className="mt-12 grid gap-8 sm:grid-cols-3">
            {MCP_STEPS.map((step, index) => (
              <li key={step.title} className="relative">
                <p className="font-[family-name:var(--font-landing-display)] text-5xl font-medium leading-none text-[var(--landing-ink)]/15">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <p className="mt-3 font-[family-name:var(--font-landing-display)] text-xl font-medium tracking-tight">
                  {step.title}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-[var(--landing-ink-soft)]">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-t border-[var(--landing-ink)]/8 px-6 py-20 sm:px-10">
        <div className="mx-auto flex max-w-5xl flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div className="max-w-xl">
            <h2 className="font-[family-name:var(--font-landing-display)] text-3xl font-medium tracking-tight sm:text-4xl">
              Agents on your real APIs. Operators on the same data.
            </h2>
            <p className="mt-3 text-base leading-relaxed text-[var(--landing-ink-soft)]">
              Every call goes through seeIt&apos;s gateway. Keys never reach the
              browser or the MCP client. Dashboards stay the ops surface for
              charts, tables and filters.
            </p>
          </div>
          <Link
            href="/signup"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[var(--landing-accent)] px-5 py-3 text-sm font-semibold text-white transition-transform duration-200 hover:-translate-y-0.5"
          >
            Open seeIt
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>

      <footer className="px-6 pb-10 pt-4 sm:px-10">
        <div className="mx-auto flex max-w-5xl items-center justify-between text-sm text-[var(--landing-ink-soft)]">
          <SeeItLogo href="/" size="sm" variant="pastel" />
          <span>MCP and dashboards from any API.</span>
        </div>
      </footer>
    </div>
  );
}
