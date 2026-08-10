"use client";

import { useCallback, useSyncExternalStore } from "react";

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/**
 * A boolean remembered in this browser, for things like "guide dismissed".
 *
 * Reading through `useSyncExternalStore` keeps the server render and the first
 * client render in agreement: both see `true`, so a guide never flashes into
 * view before we know whether it was already dismissed.
 */
export function useLocalFlag(
  key: string,
): [boolean, (value: boolean) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => window.localStorage.getItem(key) === "1",
    () => true,
  );

  const set = useCallback(
    (next: boolean) => {
      window.localStorage.setItem(key, next ? "1" : "0");
      for (const listener of listeners) listener();
    },
    [key],
  );

  return [value, set];
}
