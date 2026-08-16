"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { loadDemoAction } from "@/app/demo/actions";
import { Button } from "@/components/ui/button";

/**
 * Installs the bundled sample — spec, credentials, objects and a
 * dashboard — and drops the user straight onto the finished dashboard.
 */
export function LoadDemoButton({
  variant = "secondary",
  size,
  label = "Load the demo",
}: {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
  label?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        variant={variant}
        size={size}
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const outcome = await loadDemoAction();
            if (!outcome.ok) {
              setError(outcome.error ?? "The demo could not be installed.");
              return;
            }
            router.push(`/dashboards/${outcome.result!.dashboardSlug}`);
            router.refresh();
          });
        }}
      >
        {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
        {pending ? "Setting up the example…" : label}
      </Button>

      {error ? <p className="text-[11px] text-danger">{error}</p> : null}
    </div>
  );
}
