import "server-only";

/**
 * A small in-process TTL cache for upstream GET responses.
 *
 * A dashboard with a dozen widgets pointed at the same report endpoint would
 * otherwise fan out into a dozen identical upstream calls on every filter
 * change. Deliberately not persisted: it should disappear on restart, and
 * correctness never depends on it.
 */

interface Entry {
  value: unknown;
  expiresAt: number;
}

const MAX_ENTRIES = 500;
const store = new Map<string, Entry>();

export function cacheGet<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;

  if (entry.expiresAt <= Date.now()) {
    store.delete(key);
    return undefined;
  }

  // Refresh insertion order so the eviction below is roughly least-recently-used.
  store.delete(key);
  store.set(key, entry);
  return entry.value as T;
}

export function cacheSet(key: string, value: unknown, ttlMs: number): void {
  if (ttlMs <= 0) return;

  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next();
    if (!oldest.done) store.delete(oldest.value);
  }

  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/** Drops every entry for a connection, e.g. after its credentials change. */
export function cacheInvalidateConnection(connectionId: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(`${connectionId}:`)) store.delete(key);
  }
}

export function cacheClear(): void {
  store.clear();
}
