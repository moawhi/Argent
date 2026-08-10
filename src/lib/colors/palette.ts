/** Shared swatches for charts, number cards, and theme brand colour. */
export const COLOR_PALETTE = [
  { hex: "#2f6f5e", label: "Seafoam" },
  { hex: "#3ba884", label: "Green" },
  { hex: "#4aa3c7", label: "Sky" },
  { hex: "#c4a574", label: "Sand" },
  { hex: "#3b6fe0", label: "Blue" },
  { hex: "#c2544d", label: "Red" },
  { hex: "#e0a33b", label: "Amber" },
  { hex: "#d4652f", label: "Orange" },
  { hex: "#5a7a3a", label: "Olive" },
  { hex: "#2b3040", label: "Charcoal" },
] as const;

export type PaletteColor = (typeof COLOR_PALETTE)[number]["hex"];

export const SERIES_PALETTE = COLOR_PALETTE.map((entry) => entry.hex);

/** Named number-card accents mapped to palette hex values. */
export const ACCENT_HEX: Record<
  "brand" | "positive" | "warning" | "danger" | "neutral",
  string
> = {
  brand: "#2f6f5e",
  positive: "#3ba884",
  warning: "#e0a33b",
  danger: "#c2544d",
  neutral: "#2b3040",
};

export function normalizeHex(value: string): string {
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const [, r, g, b] = trimmed;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return trimmed;
}

export function isHexColor(value: string | null | undefined): value is string {
  if (!value) return false;
  return /^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$/.test(value.trim());
}

/** Darken a hex colour for gradient endpoints on number cards. */
export function darkenHex(hex: string, amount = 0.22): string {
  const normalized = normalizeHex(hex);
  if (!/^#[0-9a-f]{6}$/.test(normalized)) return hex;
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);
  const tone = (channel: number) =>
    Math.max(0, Math.round(channel * (1 - amount)))
      .toString(16)
      .padStart(2, "0");
  return `#${tone(r)}${tone(g)}${tone(b)}`;
}
