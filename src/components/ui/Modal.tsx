"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const WIDTH = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-3xl",
} as const;

/**
 * A centred panel for anything that needs more room than a confirmation:
 * record details, an edit form, the result of a request.
 */
export function Modal({
  open,
  title,
  description,
  size = "md",
  icon,
  footer,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  description?: ReactNode;
  size?: keyof typeof WIDTH;
  icon?: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <ModalBody
      title={title}
      description={description}
      size={size}
      icon={icon}
      footer={footer}
      onClose={onClose}
    >
      {children}
    </ModalBody>
  );
}

function ModalBody({
  title,
  description,
  size,
  icon,
  footer,
  onClose,
  children,
}: {
  title: string;
  description?: ReactNode;
  size: keyof typeof WIDTH;
  icon?: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-ink/30 backdrop-blur-[1px]"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "animate-fade-in relative flex max-h-[85vh] w-full flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-xl",
          WIDTH[size],
        )}
      >
        <div className="flex items-start gap-2.5 border-b border-line px-4 py-3">
          {icon ? <span className="mt-0.5 shrink-0">{icon}</span> : null}
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-ink">{title}</h3>
            {description ? (
              <div className="mt-0.5 text-xs leading-relaxed text-ink-soft">
                {description}
              </div>
            ) : null}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-ink-faint hover:bg-canvas hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>

        {footer ? (
          <div className="flex items-center justify-end gap-2 border-t border-line bg-canvas px-4 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
