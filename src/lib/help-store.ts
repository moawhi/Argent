"use client";

import { useSyncExternalStore } from "react";

export interface HelpTarget {
  connectionId: string;
  operationKey?: string;
  tag?: string;
  /** Qualified table id `schema.table` for database catalog help. */
  table?: string;
}

type Listener = () => void;

let current: HelpTarget | null = null;
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
}

/**
 * Opens the contextual help drawer. Called from anywhere in the builder so a
 * user can read what an endpoint does without losing their place.
 */
export function openHelp(target: HelpTarget) {
  current = target;
  emit();
}

export function closeHelp() {
  current = null;
  emit();
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return current;
}

function getServerSnapshot(): HelpTarget | null {
  return null;
}

export function useHelpTarget() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
