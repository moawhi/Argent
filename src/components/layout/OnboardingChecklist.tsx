"use client";

import Link from "next/link";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { useLocalFlag } from "@/lib/use-local-flag";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "argent.onboarding.dismissed";

/**
 * First-run guide. Hides itself once all three steps are done, and can be
 * dismissed early; the choice is remembered in this browser.
 */
export function OnboardingChecklist({
  hasConnection,
  hasObject,
  hasDashboard,
}: {
  hasConnection: boolean;
  hasObject: boolean;
  hasDashboard: boolean;
}) {
  const [dismissed, setDismissed] = useLocalFlag(DISMISS_KEY);

  const steps = [
    {
      done: hasConnection,
      title: "Connect an API",
      description:
        "Upload your Swagger or OpenAPI file. Argent reads every endpoint and spots which values are your login details.",
      href: "/connections/new",
      cta: "Import a file",
    },
    {
      done: hasObject,
      title: "Build an object",
      description:
        "Pick an endpoint and Argent suggests whether it works best as a table, a chart, a number card or a form.",
      href: "/objects/new",
      cta: "Build one",
    },
    {
      done: hasDashboard,
      title: "Arrange a dashboard",
      description:
        "Drop your objects onto a page, add a date filter at the top, and link a table to a form so clicking a row fills it in.",
      href: "/dashboards",
      cta: "Create a dashboard",
    },
  ];

  const complete = steps.every((step) => step.done);
  if (complete || dismissed) return null;

  const next = steps.find((step) => !step.done);

  return (
    <Card className="relative overflow-hidden p-5">
      <button
        onClick={() => setDismissed(true)}
        className="absolute right-3 top-3 text-ink-faint hover:text-ink"
        aria-label="Hide this guide"
      >
        <X className="size-4" />
      </button>

      <h2 className="text-sm font-semibold">Three steps to your first dashboard</h2>
      <p className="mt-0.5 text-xs text-ink-soft">
        About five minutes. You can stop after any step and come back.
      </p>

      <ol className="mt-4 space-y-3">
        {steps.map((step, index) => (
          <li key={step.title} className="flex gap-3">
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                step.done
                  ? "bg-positive text-white"
                  : step === next
                    ? "bg-brand text-white"
                    : "bg-canvas text-ink-faint",
              )}
            >
              {step.done ? <Check className="size-3.5" /> : index + 1}
            </span>

            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "text-sm",
                  step.done
                    ? "text-ink-faint line-through"
                    : "font-medium text-ink",
                )}
              >
                {step.title}
              </p>
              {!step.done ? (
                <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">
                  {step.description}
                </p>
              ) : null}
            </div>

            {step === next ? (
              <Link href={step.href} className="shrink-0 self-start">
                <Button size="sm">{step.cta}</Button>
              </Link>
            ) : null}
          </li>
        ))}
      </ol>
    </Card>
  );
}
