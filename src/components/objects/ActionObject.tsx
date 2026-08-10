"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { executeGateway } from "@/lib/gateway/client";
import { cn } from "@/lib/utils";
import type { ActionConfig } from "@/lib/objects/types";

/**
 * A single button bound to one write endpoint. Always confirms first, and
 * destructive actions additionally require typing the word "delete".
 */
export function ActionObject({
  config,
  objectId,
  operationId,
  params,
  readOnly,
  previewOnly,
  onSuccess,
}: {
  config: ActionConfig;
  objectId?: string;
  operationId?: string;
  params?: Record<string, unknown>;
  readOnly?: boolean;
  previewOnly?: boolean;
  onSuccess?: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<
    { ok: boolean; message: string; detail?: string } | null
  >(null);

  async function run() {
    setPending(true);
    setStatus(null);

    const response = await executeGateway({
      objectId,
      operationId,
      params,
      origin: "gateway",
      confirmWrite: true,
      noCache: true,
    });

    setPending(false);

    if (response.ok) {
      setStatus({ ok: true, message: config.successMessage });
      onSuccess?.();
    } else {
      setStatus({
        ok: false,
        message: response.error?.message ?? "That request did not go through.",
        detail: response.error?.detail,
      });
    }
  }

  return (
    <div className="flex h-full flex-col justify-center gap-3 p-4">
      {config.description ? (
        <p className="text-xs text-ink-soft">{config.description}</p>
      ) : null}

      <Button
        variant={config.variant === "danger" ? "danger" : "primary"}
        disabled={pending || (readOnly && !previewOnly)}
        onClick={() => {
          if (previewOnly) {
            setStatus({
              ok: true,
              message: "This is a preview, so nothing was sent.",
            });
            return;
          }
          setConfirming(true);
        }}
      >
        {pending ? <Loader2 className="animate-spin" /> : null}
        {config.label}
      </Button>

      {readOnly && !previewOnly ? (
        <p className="text-[11px] text-ink-faint">
          Turned off because this connection is read-only.
        </p>
      ) : null}

      {status ? (
        <p
          className={cn(
            "flex items-start gap-1.5 rounded-md px-2.5 py-2 text-[11px]",
            status.ok
              ? "bg-positive-soft text-positive"
              : "bg-danger-soft text-danger",
          )}
        >
          {status.ok ? (
            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
          ) : (
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          )}
          <span>
            {status.message}
            {status.detail ? (
              <span className="mt-0.5 block opacity-80">{status.detail}</span>
            ) : null}
          </span>
        </p>
      ) : null}

      <ConfirmDialog
        open={confirming}
        destructive={config.variant === "danger"}
        title={config.confirmTitle}
        description={config.confirmText}
        confirmLabel={config.label}
        confirmWord={config.variant === "danger" ? "delete" : undefined}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          void run();
        }}
      />
    </div>
  );
}
