export const SYSTEM_ROLE_KEYS = ["admin", "dev", "sales", "client"] as const;

export type SystemRoleKey = (typeof SYSTEM_ROLE_KEYS)[number];

export function isSystemRoleKey(key: string): key is SystemRoleKey {
  return (SYSTEM_ROLE_KEYS as readonly string[]).includes(key);
}

/** Stable unique-ish key from a display name (e.g. "Finance team" → "finance-team"). */
export function slugifyRoleKey(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || "role";
}
