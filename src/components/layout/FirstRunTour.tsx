"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Boxes,
  LayoutDashboard,
  Plug,
  ShieldCheck,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadDemoButton } from "./LoadDemoButton";
import { useLocalFlag } from "@/lib/use-local-flag";
import { cn } from "@/lib/utils";

const SEEN_KEY = "argent.tour.seen";

interface Step {
  icon: LucideIcon;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    icon: Plug,
    title: "Start with your API description file",
    body:
      "Upload the Swagger or OpenAPI file your developers gave you, or paste a link to it. Argent reads every endpoint out of it and works out which values are your sign-in details, so you only type them once.",
  },
  {
    icon: Boxes,
    title: "Turn an endpoint into something you can look at",
    body:
      "Pick an endpoint and Argent suggests what it is best shown as — a table of records, a chart over time, a single headline number, or a form for making changes. You adjust it beside a live preview of your real data.",
  },
  {
    icon: LayoutDashboard,
    title: "Arrange them on a site",
    body:
      "Add pages and a menu, drop tiles onto tabs, and share a date range across the site. You can link a table to a form so clicking a row fills the form in.",
  },
  {
    icon: ShieldCheck,
    title: "Your keys never reach the browser",
    body:
      "Every call goes out from Argent's own server, which holds your credentials encrypted and adds them on the way past. New connections start read-only, so nothing can be changed by accident.",
  },
];

/**
 * Shown once, the first time someone opens Argent on this machine. It explains
 * the shape of the product before they hit a blank connections page.
 */
export function FirstRunTour({ show }: { show: boolean }) {
  const [seen, setSeen] = useLocalFlag(SEEN_KEY);
  const [index, setIndex] = useState(0);

  /** Closing, skipping or following a call to action all count as seen. */
  function close() {
    setSeen(true);
  }

  if (!show || seen) return null;

  const step = STEPS[index];
  const Icon = step.icon;
  const last = index === STEPS.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
    >
      <div className="w-full max-w-lg rounded-2xl bg-surface p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
            <Icon className="size-5" />
          </span>
          <button
            onClick={close}
            className="text-ink-faint hover:text-ink"
            aria-label="Skip the tour"
          >
            <X className="size-4" />
          </button>
        </div>

        <h2 id="tour-title" className="mt-4 text-lg font-semibold tracking-tight">
          {step.title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">{step.body}</p>

        <div className="mt-6 flex items-center justify-between gap-3">
          <div className="flex gap-1.5" aria-hidden>
            {STEPS.map((entry, position) => (
              <button
                key={entry.title}
                onClick={() => setIndex(position)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  position === index ? "w-6 bg-brand" : "w-1.5 bg-line",
                )}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {index > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIndex(index - 1)}
              >
                Back
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={close}>
                Skip
              </Button>
            )}

            {last ? (
              <>
                <Link href="/connections/new" onClick={close}>
                  <Button variant="secondary" size="sm">
                    Import my API
                  </Button>
                </Link>
                {/* Stays mounted while it works; the home page will not show
                    the tour again once a connection exists. */}
                <LoadDemoButton
                  size="sm"
                  variant="primary"
                  label="Try the example"
                />
              </>
            ) : (
              <Button size="sm" onClick={() => setIndex(index + 1)}>
                Next
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
