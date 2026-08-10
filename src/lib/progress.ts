import { ERAS } from "./js-eras";

/**
 * Privacy-friendly "mark as understood" tracker.
 *
 * Completed concept ids (the stable `id`s from js-eras.ts — nothing new is
 * invented here) are persisted in localStorage under a single key. There is
 * no backend, no account, and no cross-device sync: if storage is empty or
 * unavailable (private browsing, SSR), everything degrades to "nothing
 * marked" without throwing.
 *
 * All storage access is guarded so the module is safe to import during
 * server-side rendering, where `localStorage` does not exist.
 */

const STORAGE_KEY = "runtimejs:progress";

function readCompleted(): Set<string> {
  if (typeof localStorage === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((value): value is string => typeof value === "string"));
  } catch {
    // Storage unavailable or malformed — treat as nothing marked.
    return new Set();
  }
}

function writeCompleted(ids: Set<string>): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // Storage unavailable (private browsing, quota) — the toggle still
    // holds for this visit, just nothing is persisted.
  }
}

/** True when the given concept has been marked as understood. */
export function isConceptDone(conceptId: string): boolean {
  return readCompleted().has(conceptId);
}

/** Toggle a concept's "understood" state. Safe to call from any client handler. */
export function toggleConcept(conceptId: string): void {
  const ids = readCompleted();
  if (ids.has(conceptId)) {
    ids.delete(conceptId);
  } else {
    ids.add(conceptId);
  }
  writeCompleted(ids);
}

/** Overall progress across the full concept list (all eras). */
export function getProgress(): { done: number; total: number } {
  const total = ERAS.reduce((sum, era) => sum + era.concepts.length, 0);
  return { done: readCompleted().size, total };
}
