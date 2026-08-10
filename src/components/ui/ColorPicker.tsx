"use client";

import { useState } from "react";
import { Check, Pipette } from "lucide-react";
import { COLOR_PALETTE, isHexColor, normalizeHex } from "@/lib/colors/palette";
import { cn } from "@/lib/utils";

export function ColorPicker({
  value,
  onChange,
  allowClear = false,
  clearLabel = "Default",
  size = "md",
  className,
}: {
  value?: string | null;
  onChange: (hex: string | null) => void;
  /** Show a control that clears the colour back to the theme default. */
  allowClear?: boolean;
  clearLabel?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const selected = value && isHexColor(value) ? normalizeHex(value) : null;
  const [customOpen, setCustomOpen] = useState(false);
  const swatch = size === "sm" ? "size-5" : "size-6";

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-1.5">
        {allowClear ? (
          <button
            type="button"
            onClick={() => onChange(null)}
            title={clearLabel}
            className={cn(
              "rounded-md border px-2 text-[10px] font-medium transition-colors",
              size === "sm" ? "h-5" : "h-6",
              selected === null
                ? "border-brand bg-brand-soft text-brand-ink"
                : "border-line bg-surface text-ink-soft hover:border-ink-faint hover:text-ink",
            )}
          >
            {clearLabel}
          </button>
        ) : null}

        {COLOR_PALETTE.map((entry) => {
          const active = selected === entry.hex;
          return (
            <button
              key={entry.hex}
              type="button"
              title={entry.label}
              aria-label={entry.label}
              aria-pressed={active}
              onClick={() => onChange(entry.hex)}
              className={cn(
                "relative inline-flex items-center justify-center rounded-full border transition-transform",
                swatch,
                active
                  ? "scale-110 border-ink ring-2 ring-brand/35"
                  : "border-black/10 hover:scale-105",
              )}
              style={{ backgroundColor: entry.hex }}
            >
              {active ? (
                <Check
                  className="size-3 text-white drop-shadow"
                  strokeWidth={3}
                />
              ) : null}
            </button>
          );
        })}

        <label
          className={cn(
            "relative inline-flex cursor-pointer items-center justify-center rounded-full border border-dashed border-line bg-surface text-ink-faint transition-colors hover:border-ink-faint hover:text-ink",
            swatch,
          )}
          title="Custom colour"
        >
          <Pipette className={size === "sm" ? "size-2.5" : "size-3"} />
          <input
            type="color"
            value={selected ?? "#3b6fe0"}
            onChange={(event) => {
              onChange(normalizeHex(event.target.value));
              setCustomOpen(false);
            }}
            onFocus={() => setCustomOpen(true)}
            onBlur={() => setCustomOpen(false)}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label="Custom colour"
          />
        </label>
      </div>

      {customOpen && selected ? (
        <p className="font-mono text-[10px] text-ink-faint">{selected}</p>
      ) : null}
    </div>
  );
}
