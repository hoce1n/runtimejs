import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { ERAS } from "../src/lib/js-eras";
import { getProgress, isConceptDone, toggleConcept } from "../src/lib/progress";

const STORAGE_KEY = "runtimejs:progress";
const TOTAL = ERAS.reduce((sum, era) => sum + era.concepts.length, 0);

function mockStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => void store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
}

beforeEach(() => {
  Object.defineProperty(globalThis, "localStorage", {
    value: mockStorage(),
    configurable: true,
  });
});

afterEach(() => {
  delete (globalThis as { localStorage?: Storage }).localStorage;
});

describe("progress storage", () => {
  test("getProgress total matches the full concept list", () => {
    expect(getProgress().total).toBe(TOTAL);
  });

  test("nothing is marked as done by default", () => {
    expect(getProgress()).toEqual({ done: 0, total: TOTAL });
    expect(isConceptDone("promises")).toBe(false);
  });

  test("toggleConcept marks and unmarks a concept", () => {
    expect(isConceptDone("promises")).toBe(false);
    toggleConcept("promises");
    expect(isConceptDone("promises")).toBe(true);
    expect(getProgress().done).toBe(1);
    toggleConcept("promises");
    expect(isConceptDone("promises")).toBe(false);
    expect(getProgress().done).toBe(0);
  });

  test("toggles persist across reads", () => {
    toggleConcept("promises");
    toggleConcept("tla");
    expect(isConceptDone("promises")).toBe(true);
    expect(isConceptDone("tla")).toBe(true);
    expect(getProgress()).toEqual({ done: 2, total: TOTAL });
  });

  test("keeps distinct concepts independent", () => {
    toggleConcept("var-hoisting");
    toggleConcept("callbacks");
    toggleConcept("var-hoisting");
    expect(isConceptDone("callbacks")).toBe(true);
    expect(getProgress().done).toBe(1);
  });

  test("degrades gracefully when localStorage is unavailable", () => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
    expect(() => toggleConcept("promises")).not.toThrow();
    expect(isConceptDone("promises")).toBe(false);
    expect(getProgress()).toEqual({ done: 0, total: TOTAL });
  });

  test("survives malformed stored data", () => {
    const storage = (globalThis as { localStorage?: Storage }).localStorage;
    storage!.setItem(STORAGE_KEY, "{not valid json");
    expect(isConceptDone("promises")).toBe(false);
    expect(getProgress().done).toBe(0);
    toggleConcept("promises");
    expect(isConceptDone("promises")).toBe(true);
  });

  test("ignores non-string entries in stored data", () => {
    const storage = (globalThis as { localStorage?: Storage }).localStorage;
    storage!.setItem(STORAGE_KEY, JSON.stringify(["promises", 42, null]));
    expect(isConceptDone("promises")).toBe(true);
    expect(getProgress().done).toBe(1);
  });
});
