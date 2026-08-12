import type { LayoutStorage } from "react-resizable-panels";

/**
 * SSR-safe storage adapter for `react-resizable-panels` layout persistence.
 *
 * Follows the same guarding pattern as progress.ts: the module must be safe
 * to import during server-side rendering (where `localStorage` does not
 * exist) and must never throw if storage is unavailable (private browsing,
 * quota, disabled). If storage fails, resizing still works for the visit —
 * the chosen split just isn't remembered.
 */
export const panelLayoutStorage: LayoutStorage = {
  getItem(key: string): string | null {
    if (typeof localStorage === "undefined") return null;
    try {
      return localStorage.getItem(key);
    } catch {
      // Storage unavailable — fall back to the default split.
      return null;
    }
  },
  setItem(key: string, value: string): void {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(key, value);
    } catch {
      // Storage unavailable (private browsing, quota) — the split still
      // holds for this visit, just nothing is persisted.
    }
  },
};
