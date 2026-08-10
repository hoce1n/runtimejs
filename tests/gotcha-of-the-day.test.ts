import { describe, expect, test } from "bun:test";
import { gotchaForDate, gotchaIndexForDate } from "../src/lib/gotcha-of-the-day";
import { INTERVIEW_PATTERNS } from "../src/lib/interview-patterns";

describe("gotcha of the day", () => {
  test("is deterministic for the same calendar date", () => {
    const first = new Date(2026, 7, 10);
    const second = new Date(2026, 7, 10);
    expect(gotchaIndexForDate(first)).toBe(gotchaIndexForDate(second));
    expect(gotchaForDate(first).id).toBe(gotchaForDate(second).id);
  });

  test("stays stable across any time within the same local day", () => {
    const morning = new Date(2026, 7, 10, 0, 5, 0);
    const evening = new Date(2026, 7, 10, 23, 59, 0);
    expect(gotchaForDate(morning).id).toBe(gotchaForDate(evening).id);
  });

  test("always returns a valid pattern", () => {
    for (let i = 0; i < 400; i++) {
      const date = new Date(2025, 0, 1 + i);
      const index = gotchaIndexForDate(date);
      expect(index).toBeGreaterThan(-1);
      expect(index).toBeLessThan(INTERVIEW_PATTERNS.length);
      expect(INTERVIEW_PATTERNS[index]).toBeDefined();
    }
  });

  test("advances by one pattern per calendar day", () => {
    const count = INTERVIEW_PATTERNS.length;
    for (let i = 0; i < 30; i++) {
      const today = new Date(2026, 0, 1 + i);
      const tomorrow = new Date(2026, 0, 2 + i);
      expect(gotchaIndexForDate(tomorrow)).toBe((gotchaIndexForDate(today) + 1) % count);
    }
  });

  test("cycles through the full list over consecutive days", () => {
    const base = new Date(2026, 7, 10);
    const seen = new Set<string>();
    for (let i = 0; i < INTERVIEW_PATTERNS.length; i++) {
      const date = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
      seen.add(gotchaForDate(date).id);
    }
    expect(seen.size).toBe(INTERVIEW_PATTERNS.length);
  });

  test("wraps cleanly across a year boundary", () => {
    const lastDay = new Date(2025, 11, 31);
    const newYear = new Date(2026, 0, 1);
    expect(gotchaIndexForDate(newYear)).toBe((gotchaIndexForDate(lastDay) + 1) % INTERVIEW_PATTERNS.length);
  });
});
