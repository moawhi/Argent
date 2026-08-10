"use client";

import { Monitor, Moon, Sun, Contrast, Sparkles } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { ColorPicker } from "@/components/ui/ColorPicker";
import { THEME_OPTIONS, type ThemeId } from "@/lib/theme";
import { cn } from "@/lib/utils";

const ICONS: Record<ThemeId, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
  soft: Sparkles,
  contrast: Contrast,
};

export function ThemePicker({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme, brandColor, setBrandColor } = useTheme();

  return (
    <div className={cn("space-y-3", compact && "space-y-2")}>
      <div className={cn("space-y-2", compact && "space-y-1.5")}>
        {!compact ? (
          <p className="text-xs font-medium text-ink-soft">Appearance</p>
        ) : null}
        <div className="grid gap-1">
          {THEME_OPTIONS.map((option) => {
            const Icon = ICONS[option.id];
            const active = theme === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setTheme(option.id)}
                className={cn(
                  "flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
                  active
                    ? "bg-brand-soft text-brand-ink"
                    : "text-ink-soft hover:bg-canvas hover:text-ink",
                )}
              >
                <Icon className="mt-0.5 size-3.5 shrink-0" />
                <span className="min-w-0">
                  <span className="block font-medium leading-tight">
                    {option.label}
                  </span>
                  {!compact ? (
                    <span className="block text-[11px] leading-snug text-ink-faint">
                      {option.description}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className={cn("space-y-1.5 border-t border-line pt-3", compact && "pt-2")}>
        <p className="text-xs font-medium text-ink-soft">Brand colour</p>
        {!compact ? (
          <p className="text-[11px] leading-snug text-ink-faint">
            Tints buttons, links and highlights across the app.
          </p>
        ) : null}
        <ColorPicker
          size={compact ? "sm" : "md"}
          value={brandColor}
          onChange={setBrandColor}
          allowClear
          clearLabel="Theme default"
        />
      </div>
    </div>
  );
}
