"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "./button";
import { Input, Label } from "./primitives";

/**
 * Blocking confirmation for anything irreversible.
 *
 * When `confirmWord` is supplied the user has to type it, which is deliberate
 * friction for actions that hit real data through a write-enabled connection.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmWord,
  destructive = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmWord?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  // Mounted only while open, so the typed confirmation resets every time.
  if (!open) return null;

  return (
    <ConfirmDialogBody
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      confirmWord={confirmWord}
      destructive={destructive}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}

function ConfirmDialogBody({
  title,
  description,
  confirmLabel,
  cancelLabel,
  confirmWord,
  destructive,
  onConfirm,
  onCancel,
}: {
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel: string;
  confirmWord?: string;
  destructive: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState("");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const ready = !confirmWord || typed.trim() === confirmWord.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-ink/30 backdrop-blur-[1px]"
        onClick={onCancel}
      />

      <div
        role="dialog"
        aria-modal="true"
        className="animate-fade-in relative w-full max-w-md rounded-xl border border-line bg-surface p-5 shadow-xl"
      >
        <div className="flex items-start gap-3">
          {destructive ? (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger">
              <AlertTriangle className="size-4.5" />
            </span>
          ) : null}
          <div className="min-w-0 space-y-1">
            <h3 className="text-sm font-semibold text-ink">{title}</h3>
            {description ? (
              <p className="text-xs leading-relaxed text-ink-soft">
                {description}
              </p>
            ) : null}
          </div>
        </div>

        {confirmWord ? (
          <div className="mt-4 space-y-1.5">
            <Label>
              Type <span className="font-mono text-ink">{confirmWord}</span> to
              continue
            </Label>
            <Input
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoFocus
            />
          </div>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? "danger" : "primary"}
            disabled={!ready}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
