export type ThemeId = "light" | "dark" | "system" | "soft" | "contrast";

export const THEME_OPTIONS: {
  id: ThemeId;
  label: string;
  description: string;
}[] = [
  {
    id: "light",
    label: "Light",
    description: "The default clear look.",
  },
  {
    id: "dark",
    label: "Dark",
    description: "Dim canvas for low-light desks.",
  },
  {
    id: "system",
    label: "System",
    description: "Follows your operating system.",
  },
  {
    id: "soft",
    label: "Soft light",
    description: "Cooler, gentler light surfaces.",
  },
  {
    id: "contrast",
    label: "High contrast",
    description: "Stronger ink for sharper reading.",
  },
];

export const THEME_STORAGE_KEY = "argent-theme";
export const BRAND_COLOR_STORAGE_KEY = "argent-brand-color";

/** Inline boot script for SSR (injected via useServerInsertedHTML). */
export const THEME_BOOT_SCRIPT = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var p=localStorage.getItem(k)||'light';var r=p;if(p==='system'){r=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.dataset.theme=r;document.documentElement.dataset.themePref=p;var b=localStorage.getItem(${JSON.stringify(BRAND_COLOR_STORAGE_KEY)});if(b&&/^#[0-9a-fA-F]{6}$/.test(b)){var s=document.documentElement.style;s.setProperty('--color-brand',b);s.setProperty('--color-brand-soft','color-mix(in oklab,'+b+' 16%, var(--color-surface))');s.setProperty('--color-brand-ink','color-mix(in oklab,'+b+' 72%, var(--color-ink))');}}catch(e){}})();`;

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return (
    value === "light" ||
    value === "dark" ||
    value === "system" ||
    value === "soft" ||
    value === "contrast"
  );
}

/** Resolves `system` to the concrete theme the document should use. */
export function resolveTheme(theme: ThemeId): "light" | "dark" | "soft" | "contrast" {
  if (theme !== "system") return theme;
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function applyTheme(theme: ThemeId) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = resolveTheme(theme);
  document.documentElement.dataset.themePref = theme;
}

export function isBrandColor(value: string | null | undefined): value is string {
  return Boolean(value && /^#[0-9a-fA-F]{6}$/.test(value.trim()));
}

/** Overrides the brand token trio, or clears back to the active theme defaults. */
export function applyBrandColor(hex: string | null) {
  if (typeof document === "undefined") return;
  const style = document.documentElement.style;
  if (!hex || !isBrandColor(hex)) {
    style.removeProperty("--color-brand");
    style.removeProperty("--color-brand-soft");
    style.removeProperty("--color-brand-ink");
    return;
  }
  const normalized = hex.trim().toLowerCase();
  style.setProperty("--color-brand", normalized);
  style.setProperty(
    "--color-brand-soft",
    `color-mix(in oklab, ${normalized} 16%, var(--color-surface))`,
  );
  style.setProperty(
    "--color-brand-ink",
    `color-mix(in oklab, ${normalized} 72%, var(--color-ink))`,
  );
}

export function readStoredBrandColor(): string | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(BRAND_COLOR_STORAGE_KEY);
  return isBrandColor(stored) ? stored.trim().toLowerCase() : null;
}
