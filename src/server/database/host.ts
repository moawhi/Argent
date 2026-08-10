/** Same allowlist as the HTTP gateway; empty means any host is fine (dev). */
export function dbHostAllowed(hostname: string): boolean {
  const raw = process.env.GATEWAY_ALLOWED_HOSTS?.trim();
  if (!raw) return true;

  const allowed = raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  const host = hostname.toLowerCase();
  return allowed.some(
    (entry) => host === entry || host.endsWith(`.${entry}`),
  );
}
